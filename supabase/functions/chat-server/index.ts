import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

interface TokenStatus {
  tokens_remaining: number;
  credits_remaining: number;
  credits_granted: number;
  at_limit: boolean;
  period_end: string;
  plan: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Supabase client for user auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin: AnySupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body - accept server_id (discord_guild_id), query, channel_name
    const { server_id, query, channel_name } = await req.json();

    if (!server_id || !query) {
      return new Response(JSON.stringify({ error: "Missing server_id or query" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's discord_user_id from users table
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("discord_user_id")
      .eq("id", user.id)
      .single();

    if (userDataError || !userData?.discord_user_id) {
      console.error("User data error:", userDataError);
      return new Response(JSON.stringify({ error: "User not linked to Discord" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user has access to this server via user_servers table
    const { data: serverAccess, error: accessError } = await supabase
      .from("user_servers")
      .select("id")
      .eq("discord_user_id", userData.discord_user_id)
      .eq("discord_server_id", server_id)
      .maybeSingle();

    // Also check if user owns the server directly via servers table
    const { data: ownedServer, error: ownedError } = await supabase
      .from("servers")
      .select("id")
      .eq("owner_id", user.id)
      .eq("discord_guild_id", server_id)
      .maybeSingle();

    if ((accessError && ownedError) || (!serverAccess && !ownedServer)) {
      console.log("Access denied for user", user.id, "to server", server_id);
      return new Response(JSON.stringify({ error: "Access denied to this server" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================
    // CHECK TOKEN STATUS BEFORE AI CALL
    // ========================================
    const tokenStatus = await checkTokenStatus(supabaseAdmin, server_id);
    
    if (tokenStatus.at_limit) {
      const periodEndDate = new Date(tokenStatus.period_end).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      
      console.log(`Server ${server_id} at credit limit, blocking chat request`);
      
      return new Response(JSON.stringify({ 
        error: "credit_limit_reached",
        message: `This server has used all its AI credits for this month. Credits will reset on ${periodEndDate}.`,
        credits_remaining: 0,
        credits_granted: tokenStatus.credits_granted,
        period_end: tokenStatus.period_end,
        plan: tokenStatus.plan,
      }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get n8n webhook URL from environment
    const n8nChatWebhookUrl = Deno.env.get("N8N_CHAT_WEBHOOK_URL");
    if (!n8nChatWebhookUrl) {
      console.error("N8N_CHAT_WEBHOOK_URL not configured");
      return new Response(JSON.stringify({ error: "Chat service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build payload for n8n - matches expected format from Webhook node
    // The n8n Config node maps: content, supabase_user_id, channel_name, server_id
    const n8nPayload = {
      content: query,
      supabase_user_id: user.id,
      channel_name: channel_name || "dashboard",
      server_id: server_id,
    };

    console.log("Calling n8n chat webhook for server:", server_id, "channel:", channel_name);

    // Send request to n8n
    const n8nResponse = await fetch(n8nChatWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(n8nPayload),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error("n8n error:", n8nResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to get response from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // n8n returns plain text from Respond to Webhook node (responseBody = {{$json.output}})
    const answerText = await n8nResponse.text();
    console.log("n8n response received, length:", answerText.length);

    // ========================================
    // LOG TOKEN USAGE (estimate if n8n doesn't provide)
    // n8n should call log-server-token-usage directly with actual counts
    // This is a fallback estimate for dashboard chat
    // ========================================
    let updatedTokenStatus: TokenStatus | null = null;
    try {
      // Estimate tokens: ~4 chars per token for English text
      const estimatedPromptTokens = Math.ceil(query.length / 4);
      const estimatedCompletionTokens = Math.ceil(answerText.length / 4);
      
      updatedTokenStatus = await logTokenUsage(supabaseAdmin, {
        server_id,
        prompt_tokens: estimatedPromptTokens,
        completion_tokens: estimatedCompletionTokens,
        feature: "dashboard_chat",
        user_id: user.id,
        channel_name: channel_name || "dashboard",
        model: "estimated", // n8n should log actual model
        provider: "n8n",
      });
      
      console.log(`Logged estimated ${estimatedPromptTokens + estimatedCompletionTokens} tokens for dashboard chat`);
    } catch (tokenErr) {
      console.error("Failed to log token usage:", tokenErr);
      // Don't fail the request if token logging fails
    }

    // Log activity to server_activity table
    try {
      // Get user's display name or email prefix for activity log
      const userName = user.user_metadata?.full_name || 
                       user.user_metadata?.name || 
                       user.email?.split("@")[0] || 
                       "User";
      
      const { error: activityError } = await supabase
        .from("server_activity")
        .insert({
          server_id: server_id,
          source: "dashboard",
          user_name: userName,
          channel_name: channel_name || "dashboard",
          query: query,
        });

      if (activityError) {
        console.error("Failed to log activity:", activityError);
        // Don't fail the request if activity logging fails
      } else {
        console.log("Activity logged for server:", server_id);
      }
    } catch (activityErr) {
      console.error("Activity logging error:", activityErr);
      // Don't fail the request if activity logging fails
    }

    // Return the answer wrapped in JSON for frontend with credit info
    return new Response(JSON.stringify({ 
      answer: answerText || "No response from Gravilo",
      credits_remaining: updatedTokenStatus?.credits_remaining ?? tokenStatus.credits_remaining,
      credits_granted: updatedTokenStatus?.credits_granted ?? tokenStatus.credits_granted,
      plan: tokenStatus.plan,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Chat server error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Check token status for a server using the v_server_token_allowance_current view
 */
async function checkTokenStatus(supabase: AnySupabaseClient, serverId: string): Promise<TokenStatus> {
  // First ensure allowance period exists
  const now = new Date();
  
  // Check for existing current period
  const { data: existing } = await supabase
    .from("server_token_allowances")
    .select("*")
    .eq("server_id", serverId)
    .lte("period_start", now.toISOString())
    .gte("period_end", now.toISOString())
    .maybeSingle();

  if (!existing) {
    // Create allowance period if it doesn't exist
    await ensureAllowancePeriod(supabase, serverId);
  }

  // Query the view for current status
  const { data: viewData, error: viewError } = await supabase
    .from("v_server_token_allowance_current")
    .select("*")
    .eq("server_id", serverId)
    .maybeSingle();

  if (viewError) {
    console.error("Error fetching token status from view:", viewError);
    // Fallback: allow request but log error
    return {
      tokens_remaining: 999999,
      credits_remaining: 999,
      credits_granted: 999,
      at_limit: false,
      period_end: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
      plan: "free",
    };
  }

  if (!viewData) {
    // No allowance found, create one and return defaults
    await ensureAllowancePeriod(supabase, serverId);
    return {
      tokens_remaining: 60000,
      credits_remaining: 300,
      credits_granted: 300,
      at_limit: false,
      period_end: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
      plan: "free",
    };
  }

  // Get server plan
  const plan = await getServerPlan(supabase, serverId);

  const tokensRemaining = (viewData.remaining_tokens as number) || 0;
  const creditsRemaining = (viewData.remaining_credits as number) || 0;
  const creditsGranted = (viewData.credits_granted as number) || 0;

  return {
    tokens_remaining: tokensRemaining,
    credits_remaining: creditsRemaining,
    credits_granted: creditsGranted,
    at_limit: tokensRemaining <= 0,
    period_end: viewData.period_end as string,
    plan,
  };
}

/**
 * Ensure a token allowance period exists for the server
 */
async function ensureAllowancePeriod(supabase: AnySupabaseClient, serverId: string): Promise<void> {
  const now = new Date();
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
    const previousRemaining = (previousPeriod.tokens_granted || 0) - (previousPeriod.tokens_used || 0);
    rolloverTokens = Math.max(0, Math.min(previousRemaining, baseTokens));
  }

  const tokensGranted = baseTokens + rolloverTokens;

  // Insert new period (upsert to handle race conditions)
  const { error: insertError } = await supabase
    .from("server_token_allowances")
    .upsert({
      server_id: serverId,
      tokens_granted: tokensGranted,
      tokens_used: 0,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      source: plan === "premium" ? "subscription" : "free_tier",
      metadata: { base_tokens: baseTokens, rollover_tokens: rolloverTokens, plan },
    }, {
      onConflict: "server_id,period_start",
      ignoreDuplicates: true,
    });

  if (insertError && insertError.code !== "23505") {
    console.error("Failed to create allowance period:", insertError);
  }
}

/**
 * Get server plan (free or premium)
 */
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

interface LogUsageParams {
  server_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  feature: string;
  user_id?: string;
  channel_name?: string;
  model?: string;
  provider?: string;
}

/**
 * Log token usage and update allowance
 */
async function logTokenUsage(supabase: AnySupabaseClient, params: LogUsageParams): Promise<TokenStatus> {
  const {
    server_id,
    prompt_tokens,
    completion_tokens,
    feature,
    user_id,
    channel_name,
    model,
    provider,
  } = params;

  const totalTokens = prompt_tokens + completion_tokens;
  const now = new Date();

  // Get tokens_per_credit setting
  const { data: settingsData } = await supabase
    .from("ai_credit_settings")
    .select("value_int")
    .eq("key", "tokens_per_credit")
    .single();

  const tokensPerCredit = settingsData?.value_int || 200;
  const creditsCharged = Math.ceil(totalTokens / tokensPerCredit);

  // Generate idempotency key
  const idempotencyKey = `${server_id}-${user_id || "system"}-${Date.now()}`;

  // Insert token event
  const { error: eventError } = await supabase
    .from("server_token_events")
    .insert({
      server_id,
      prompt_tokens,
      completion_tokens,
      total_tokens: totalTokens,
      credits_charged: creditsCharged,
      feature,
      user_id,
      channel_name,
      model,
      provider,
      idempotency_key: idempotencyKey,
    });

  if (eventError && eventError.code !== "23505") {
    console.error("Failed to insert token event:", eventError);
  }

  // Get current allowance and atomically update tokens_used
  const { data: currentAllowance } = await supabase
    .from("server_token_allowances")
    .select("id, tokens_used, tokens_granted")
    .eq("server_id", server_id)
    .lte("period_start", now.toISOString())
    .gte("period_end", now.toISOString())
    .single();

  if (currentAllowance) {
    const newTokensUsed = (currentAllowance.tokens_used || 0) + totalTokens;
    await supabase
      .from("server_token_allowances")
      .update({ tokens_used: newTokensUsed, updated_at: now.toISOString() })
      .eq("id", currentAllowance.id);

    const tokensRemaining = (currentAllowance.tokens_granted || 0) - newTokensUsed;
    const creditsGranted = Math.floor((currentAllowance.tokens_granted || 0) / tokensPerCredit);
    const creditsRemaining = Math.floor(tokensRemaining / tokensPerCredit);

    return {
      tokens_remaining: tokensRemaining,
      credits_remaining: creditsRemaining,
      credits_granted: creditsGranted,
      at_limit: tokensRemaining <= 0,
      period_end: now.toISOString(),
      plan: await getServerPlan(supabase, server_id),
    };
  }

  // Fallback
  return {
    tokens_remaining: 0,
    credits_remaining: 0,
    credits_granted: 0,
    at_limit: true,
    period_end: now.toISOString(),
    plan: "free",
  };
}
