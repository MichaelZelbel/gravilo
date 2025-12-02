import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    console.error("[STRIPE-WEBHOOK] Missing signature or webhook secret");
    return new Response(JSON.stringify({ error: "Missing signature or secret" }), {
      status: 400,
    });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log("[STRIPE-WEBHOOK] Event received:", event.type);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const customerId = session.customer as string;

      console.log("[STRIPE-WEBHOOK] Checkout completed for user:", userId, "customer:", customerId);

      if (userId) {
        // Update user to premium plan and save customer ID
        const { error } = await supabase
          .from("users")
          .update({
            plan: "premium",
            stripe_customer_id: customerId,
          })
          .eq("id", userId);

        if (error) {
          console.error("[STRIPE-WEBHOOK] Error updating user:", error);
        } else {
          console.log("[STRIPE-WEBHOOK] User upgraded to premium successfully");
        }
      }
    }

    // Handle subscription deleted (cancellation)
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      console.log("[STRIPE-WEBHOOK] Subscription deleted for customer:", customerId);

      // Find user by customer ID and downgrade to free
      const { error } = await supabase
        .from("users")
        .update({ plan: "free" })
        .eq("stripe_customer_id", customerId);

      if (error) {
        console.error("[STRIPE-WEBHOOK] Error downgrading user:", error);
      } else {
        console.log("[STRIPE-WEBHOOK] User downgraded to free successfully");
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
    });
  } catch (error) {
    console.error("[STRIPE-WEBHOOK] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
});

// Discord bot can call this endpoint when a user subscribes via Discord
// POST https://<project>.supabase.co/functions/v1/stripe-webhook
// with Stripe-Signature header for verification
