import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Gravilo Premium price ID
const STRIPE_PRICE_ID_PREMIUM = "price_1SZiF5AiLddHHjhkm32oqSVI";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    // Get server_id from query params
    const url = new URL(req.url);
    const server_id = url.searchParams.get("server_id");

    if (!server_id) {
      console.error("[CREATE-SERVER-CHECKOUT] Missing server_id");
      return new Response(JSON.stringify({ error: "server_id is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    console.log("[CREATE-SERVER-CHECKOUT] User authenticated:", user.id, "for server:", server_id);

    // Verify user owns this server
    const { data: serverData, error: serverError } = await supabaseClient
      .from("servers")
      .select("id, name, owner_id")
      .eq("id", server_id)
      .eq("owner_id", user.id)
      .single();

    if (serverError || !serverData) {
      console.error("[CREATE-SERVER-CHECKOUT] Server not found or access denied:", serverError);
      return new Response(JSON.stringify({ error: "Server not found or access denied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    console.log("[CREATE-SERVER-CHECKOUT] Server verified:", serverData.name);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("[CREATE-SERVER-CHECKOUT] Found existing customer:", customerId);
    } else {
      console.log("[CREATE-SERVER-CHECKOUT] No existing customer found");
    }

    // Create customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
          app: "gravilo",
        },
      });
      customerId = customer.id;
      console.log("[CREATE-SERVER-CHECKOUT] Created new customer:", customerId);
    }

    // Save customer ID to users table
    await supabaseClient
      .from("users")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);

    const origin = req.headers.get("origin") || "https://preview--0d6a5bb6-e310-46ff-ace1-5abe86b27a44.lovable.app";

    // Create checkout session with server_id in metadata
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: STRIPE_PRICE_ID_PREMIUM,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/billing/success?server_id=${server_id}`,
      cancel_url: `${origin}/dashboard`,
      metadata: {
        app: "gravilo",
        server_id: server_id,
        supabase_user_id: user.id,
      },
      subscription_data: {
        metadata: {
          app: "gravilo",
          server_id: server_id,
          supabase_user_id: user.id,
        },
      },
    });

    console.log("[CREATE-SERVER-CHECKOUT] Checkout session created:", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[CREATE-SERVER-CHECKOUT] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
