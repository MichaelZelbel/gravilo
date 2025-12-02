import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

// Gravilo Premium price ID
const GRAVILO_PREMIUM_PRICE = "price_1SZiF5AiLddHHjhkm32oqSVI";

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

      // Security: Only handle Gravilo sessions
      if (session.metadata?.app !== "gravilo") {
        console.log("[STRIPE-WEBHOOK] Ignored - not a Gravilo session");
        return new Response(JSON.stringify({ ignored: true }), { status: 200 });
      }

      const subscriptionId = session.subscription as string;
      const server_id = session.metadata?.server_id;
      const supabaseUserId = session.metadata?.supabase_user_id;
      const customerId = session.customer as string;

      console.log("[STRIPE-WEBHOOK] Checkout completed:", {
        server_id,
        supabaseUserId,
        subscriptionId,
        customerId,
      });

      // Verify this is the Gravilo Premium price
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price"],
      });

      const matchesPrice = subscription.items.data.some(
        (item: any) => item.price.id === GRAVILO_PREMIUM_PRICE
      );

      if (!matchesPrice) {
        console.log("[STRIPE-WEBHOOK] Ignored - not Gravilo Premium price");
        return new Response(JSON.stringify({ ignored: true }), { status: 200 });
      }

      // SERVER-LEVEL UPGRADE: Upsert to server_plans table
      if (server_id) {
        console.log("[STRIPE-WEBHOOK] Processing server-level upgrade for server:", server_id);

        const { error: serverPlanError } = await supabase
          .from("server_plans")
          .upsert(
            {
              server_id: server_id,
              plan: "premium",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "server_id" }
          );

        if (serverPlanError) {
          console.error("[STRIPE-WEBHOOK] Error upserting server_plans:", serverPlanError);
        } else {
          console.log("[STRIPE-WEBHOOK] Server upgraded to premium successfully");
        }

        // Also update the server's message_limit to premium tier (10,000 messages)
        const { error: serverUpdateError } = await supabase
          .from("servers")
          .update({ message_limit: 10000 })
          .eq("id", server_id);

        if (serverUpdateError) {
          console.error("[STRIPE-WEBHOOK] Error updating server message_limit:", serverUpdateError);
        } else {
          console.log("[STRIPE-WEBHOOK] Server message_limit updated to premium tier");
        }
      }

      // USER-LEVEL UPGRADE (legacy/fallback): Update users table
      if (supabaseUserId && !server_id) {
        console.log("[STRIPE-WEBHOOK] Processing user-level upgrade for user:", supabaseUserId);

        const { error } = await supabase
          .from("users")
          .update({
            plan: "premium",
            stripe_customer_id: customerId,
          })
          .eq("id", supabaseUserId);

        if (error) {
          console.error("[STRIPE-WEBHOOK] Error updating user:", error);
        } else {
          console.log("[STRIPE-WEBHOOK] User upgraded to premium successfully");
        }
      }

      // Always save stripe_customer_id to user if we have userId
      if (supabaseUserId) {
        await supabase
          .from("users")
          .update({ stripe_customer_id: customerId })
          .eq("id", supabaseUserId);
      }
    }

    // Handle subscription deleted (cancellation)
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const server_id = subscription.metadata?.server_id;

      console.log("[STRIPE-WEBHOOK] Subscription deleted:", { customerId, server_id });

      // Verify this is the Gravilo Premium price
      const matchesPrice = subscription.items.data.some(
        (item: any) => item.price.id === GRAVILO_PREMIUM_PRICE
      );

      if (!matchesPrice) {
        console.log("[STRIPE-WEBHOOK] Ignored - not Gravilo Premium subscription");
        return new Response(JSON.stringify({ ignored: true }), { status: 200 });
      }

      // SERVER-LEVEL DOWNGRADE
      if (server_id) {
        console.log("[STRIPE-WEBHOOK] Processing server-level downgrade for server:", server_id);

        const { error: serverPlanError } = await supabase
          .from("server_plans")
          .upsert(
            {
              server_id: server_id,
              plan: "free",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "server_id" }
          );

        if (serverPlanError) {
          console.error("[STRIPE-WEBHOOK] Error downgrading server_plans:", serverPlanError);
        } else {
          console.log("[STRIPE-WEBHOOK] Server downgraded to free successfully");
        }

        // Reset server's message_limit to free tier (3,000 messages)
        const { error: serverUpdateError } = await supabase
          .from("servers")
          .update({ message_limit: 3000 })
          .eq("id", server_id);

        if (serverUpdateError) {
          console.error("[STRIPE-WEBHOOK] Error resetting server message_limit:", serverUpdateError);
        } else {
          console.log("[STRIPE-WEBHOOK] Server message_limit reset to free tier");
        }
      }

      // USER-LEVEL DOWNGRADE (legacy fallback)
      if (!server_id) {
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
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error("[STRIPE-WEBHOOK] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), { status: 400 });
  }
});
