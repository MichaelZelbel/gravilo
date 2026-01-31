import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-secret",
};

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

interface UsageRequest {
  server_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  feature: string;
  model?: string;
  provider?: string;
  discord_user_id?: string;
  user_id?: string;
  channel_name?: string;
  metadata?: Record<string, unknown>;
  idempotency_key?: string;
}

interface UsageResponse {
  success: boolean;
  event_id: string;
  tokens_used: number;
  tokens_remaining: number;
  credits_remaining: number;
  tokens_granted: number;
  credits_granted: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const botSecret = Deno.env.get("DISCORD_BOT_SYNC_SECRET");
    
    const supabaseAdmin: AnySupabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    const xBotSecret = req.headers.get("x-bot-secret");
    
    let authenticatedUserId: string | null = null;
    let isBotCall = false;

    // Check bot secret first
    if (xBotSecret && botSecret && xBotSecret === botSecret) {
      isBotCall = true;
    } else if (authHeader) {
      // Validate JWT
      const supabaseUser: AnySupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      
      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authenticatedUserId = user.id;
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized - provide x-bot-secret or Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body: UsageRequest = await req.json();
    const {
      server_id,
      prompt_tokens,
      completion_tokens,
      feature,
      model,
      provider,
      discord_user_id,
      user_id,
      channel_name,
      metadata,
      idempotency_key,
    } = body;

    // Validate required fields
    if (!server_id) {
      return new Response(JSON.stringify({ error: "server_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof prompt_tokens !== "number" || typeof completion_tokens !== "number") {
      return new Response(JSON.stringify({ error: "prompt_tokens and completion_tokens are required integers" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!feature) {
      return new Response(JSON.stringify({ error: "feature is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate totals
    const totalTokens = prompt_tokens + completion_tokens;

    // Get tokens_per_credit from settings
    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from("ai_credit_settings")
      .select("value_int")
      .eq("key", "tokens_per_credit")
      .single();

    if (settingsError) {
      console.error("Failed to get credit settings:", settingsError);
      return new Response(JSON.stringify({ error: "Failed to get credit settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokensPerCredit = settingsData.value_int || 200;
    const creditsCharged = totalTokens / tokensPerCredit;

    // Get or create current allowance period
    const allowance = await ensureServerAllowance(supabaseAdmin, server_id);
    
    if (!allowance) {
      return new Response(JSON.stringify({ error: "Failed to get or create allowance period" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if server has sufficient tokens
    const projectedUsage = allowance.tokens_used + totalTokens;
    if (projectedUsage > allowance.tokens_granted) {
      const remaining = allowance.tokens_granted - allowance.tokens_used;
      return new Response(JSON.stringify({
        success: false,
        error: "Insufficient tokens",
        tokens_remaining: remaining,
        credits_remaining: Math.floor(remaining / tokensPerCredit),
        tokens_requested: totalTokens,
        tokens_granted: allowance.tokens_granted,
      }), {
        status: 402, // Payment Required
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate idempotency key if not provided
    const finalIdempotencyKey = idempotency_key || `${server_id}-${feature}-${Date.now()}-${crypto.randomUUID()}`;

    // Insert event into server_token_events
    const { data: eventData, error: eventError } = await supabaseAdmin
      .from("server_token_events")
      .insert({
        server_id,
        user_id: user_id || authenticatedUserId,
        discord_user_id,
        idempotency_key: finalIdempotencyKey,
        feature,
        model,
        provider,
        prompt_tokens,
        completion_tokens,
        total_tokens: totalTokens,
        credits_charged: creditsCharged,
        channel_name,
        metadata: metadata || {},
      })
      .select("id")
      .single();

    if (eventError) {
      // Handle duplicate idempotency key - return success (already processed)
      if (eventError.code === "23505") {
        console.log(`Duplicate idempotency key: ${finalIdempotencyKey}`);
        return new Response(JSON.stringify({
          success: true,
          event_id: "duplicate",
          tokens_used: allowance.tokens_used,
          tokens_remaining: allowance.tokens_granted - allowance.tokens_used,
          credits_remaining: Math.floor((allowance.tokens_granted - allowance.tokens_used) / tokensPerCredit),
          tokens_granted: allowance.tokens_granted,
          credits_granted: Math.floor(allowance.tokens_granted / tokensPerCredit),
          note: "Already processed (idempotency key match)",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("Failed to insert token event:", eventError);
      return new Response(JSON.stringify({ error: "Failed to log token usage" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update server_token_allowances.tokens_used
    const newTokensUsed = allowance.tokens_used + totalTokens;
    const { error: updateError } = await supabaseAdmin
      .from("server_token_allowances")
      .update({ tokens_used: newTokensUsed })
      .eq("id", allowance.id);

    if (updateError) {
      console.error("Failed to update allowance:", updateError);
      // Event was logged, but balance update failed - log warning but don't fail
      console.warn(`Token event ${eventData.id} logged but allowance update failed for server ${server_id}`);
    }

    const tokensRemaining = allowance.tokens_granted - newTokensUsed;
    const creditsRemaining = Math.floor(tokensRemaining / tokensPerCredit);

    console.log(`Logged ${totalTokens} tokens for server ${server_id} (${feature}). Remaining: ${tokensRemaining}`);

    const response: UsageResponse = {
      success: true,
      event_id: eventData.id,
      tokens_used: newTokensUsed,
      tokens_remaining: tokensRemaining,
      credits_remaining: creditsRemaining,
      tokens_granted: allowance.tokens_granted,
      credits_granted: Math.floor(allowance.tokens_granted / tokensPerCredit),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in log-server-token-usage:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface AllowanceRecord {
  id: string;
  server_id: string;
  tokens_granted: number;
  tokens_used: number;
  period_start: string;
  period_end: string;
  source: string;
  metadata: Record<string, unknown>;
}

async function ensureServerAllowance(supabase: AnySupabaseClient, serverId: string): Promise<AllowanceRecord | null> {
  const now = new Date();
  
  // Check for existing current period
  const { data: existing, error: existingError } = await supabase
    .from("server_token_allowances")
    .select("*")
    .eq("server_id", serverId)
    .lte("period_start", now.toISOString())
    .gte("period_end", now.toISOString())
    .maybeSingle();

  if (existing) {
    return existing as AllowanceRecord;
  }

  if (existingError) {
    console.error("Error checking existing allowance:", existingError);
  }

  // No current period - create one
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

  // Get server plan
  const plan = await getServerPlan(supabase, serverId);
  
  // Get token settings
  const { data: settings } = await supabase
    .from("ai_credit_settings")
    .select("key, value_int");

  const settingsMap: Record<string, number> = {};
  for (const s of settings || []) {
    settingsMap[s.key] = s.value_int;
  }

  const baseTokens = plan === "premium"
    ? (settingsMap.tokens_premium_per_month || 600000)
    : (settingsMap.tokens_free_per_month || 60000);

  // Check for previous period rollover
  let rolloverTokens = 0;
  const { data: previousPeriod } = await supabase
    .from("server_token_allowances")
    .select("tokens_granted, tokens_used")
    .eq("server_id", serverId)
    .lt("period_end", periodStart.toISOString())
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousPeriod) {
    const previousRemaining = previousPeriod.tokens_granted - previousPeriod.tokens_used;
    rolloverTokens = Math.max(0, Math.min(previousRemaining, baseTokens));
  }

  const tokensGranted = baseTokens + rolloverTokens;

  // Insert new period
  const { data: newPeriod, error: insertError } = await supabase
    .from("server_token_allowances")
    .insert({
      server_id: serverId,
      tokens_granted: tokensGranted,
      tokens_used: 0,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      source: plan === "premium" ? "subscription" : "free_tier",
      metadata: { base_tokens: baseTokens, rollover_tokens: rolloverTokens, plan },
    })
    .select()
    .single();

  if (insertError) {
    // Handle race condition
    if (insertError.code === "23505") {
      const { data: racedPeriod } = await supabase
        .from("server_token_allowances")
        .select("*")
        .eq("server_id", serverId)
        .lte("period_start", now.toISOString())
        .gte("period_end", now.toISOString())
        .single();
      
      return racedPeriod as AllowanceRecord;
    }
    console.error("Failed to create allowance:", insertError);
    return null;
  }

  console.log(`Created allowance for server ${serverId}: ${tokensGranted} tokens`);
  return newPeriod as AllowanceRecord;
}

async function getServerPlan(supabase: AnySupabaseClient, serverId: string): Promise<string> {
  const { data: server } = await supabase
    .from("servers")
    .select("id")
    .eq("discord_guild_id", serverId)
    .maybeSingle();

  if (!server) return "free";

  const { data: plan } = await supabase
    .from("server_plans")
    .select("plan")
    .eq("server_id", server.id)
    .maybeSingle();

  return plan?.plan || "free";
}
