import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-secret",
};

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

interface TokenStatusResponse {
  server_id: string;
  plan: "free" | "premium";
  tokens_granted: number;
  tokens_used: number;
  tokens_remaining: number;
  tokens_per_credit: number;
  credits_granted: number;
  credits_used: number;
  credits_remaining: number;
  period_start: string;
  period_end: string;
  rollover_tokens: number;
  base_tokens: number;
  at_limit: boolean;
  usage_percentage: number;
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
    
    // Get server_id from query params or body
    const url = new URL(req.url);
    let serverId = url.searchParams.get("server_id");
    
    if (!serverId && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      serverId = body.server_id;
    }

    if (!serverId) {
      return new Response(JSON.stringify({ error: "server_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    const xBotSecret = req.headers.get("x-bot-secret");
    
    let userId: string | null = null;
    let isBotCall = false;

    if (xBotSecret && botSecret && xBotSecret === botSecret) {
      isBotCall = true;
    } else if (authHeader) {
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
      userId = user.id;

      // Check user access to server
      const hasAccess = await checkServerAccess(supabaseAdmin, userId, serverId);
      if (!hasAccess) {
        return new Response(JSON.stringify({ error: "Access denied to this server" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized - provide x-bot-secret or Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure allowance period exists
    const allowance = await ensureServerAllowance(supabaseAdmin, serverId);
    if (!allowance) {
      return new Response(JSON.stringify({ error: "Failed to get or create allowance period" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get server plan
    const plan = await getServerPlan(supabaseAdmin, serverId);

    // Get tokens_per_credit from settings
    const { data: settingsData } = await supabaseAdmin
      .from("ai_credit_settings")
      .select("value_int")
      .eq("key", "tokens_per_credit")
      .single();

    const tokensPerCredit = settingsData?.value_int || 200;

    // Calculate all values
    const tokensGranted = allowance.tokens_granted;
    const tokensUsed = allowance.tokens_used;
    const tokensRemaining = tokensGranted - tokensUsed;
    const creditsGranted = Math.floor(tokensGranted / tokensPerCredit);
    const creditsUsed = Math.floor(tokensUsed / tokensPerCredit);
    const creditsRemaining = Math.floor(tokensRemaining / tokensPerCredit);
    const usagePercentage = tokensGranted > 0 ? Math.round((tokensUsed / tokensGranted) * 100) : 0;
    const atLimit = tokensRemaining <= 0;

    // Extract rollover and base from metadata
    const metadata = allowance.metadata || {};
    const rolloverTokens = Number(metadata.rollover_tokens) || 0;
    const baseTokens = Number(metadata.base_tokens) || tokensGranted;

    const response: TokenStatusResponse = {
      server_id: serverId,
      plan: plan as "free" | "premium",
      tokens_granted: tokensGranted,
      tokens_used: tokensUsed,
      tokens_remaining: tokensRemaining,
      tokens_per_credit: tokensPerCredit,
      credits_granted: creditsGranted,
      credits_used: creditsUsed,
      credits_remaining: creditsRemaining,
      period_start: allowance.period_start,
      period_end: allowance.period_end,
      rollover_tokens: rolloverTokens,
      base_tokens: baseTokens,
      at_limit: atLimit,
      usage_percentage: usagePercentage,
    };

    console.log(`Token status for server ${serverId}: ${creditsUsed}/${creditsGranted} credits (${usagePercentage}%)`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in get-server-token-status:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function checkServerAccess(supabase: AnySupabaseClient, userId: string, serverId: string): Promise<boolean> {
  // Check if user owns the server
  const { data: ownedServer } = await supabase
    .from("servers")
    .select("id")
    .eq("owner_id", userId)
    .eq("discord_guild_id", serverId)
    .maybeSingle();

  if (ownedServer) return true;

  // Check admin role
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin) return true;

  // Check if user has access via user_servers
  const { data: userData } = await supabase
    .from("users")
    .select("discord_user_id")
    .eq("id", userId)
    .single();

  if (!userData?.discord_user_id) return false;

  const { data: serverAccess } = await supabase
    .from("user_servers")
    .select("id")
    .eq("discord_user_id", userData.discord_user_id)
    .eq("discord_server_id", serverId)
    .maybeSingle();

  return !!serverAccess;
}

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
  const { data: existing } = await supabase
    .from("server_token_allowances")
    .select("*")
    .eq("server_id", serverId)
    .lte("period_start", now.toISOString())
    .gte("period_end", now.toISOString())
    .maybeSingle();

  if (existing) {
    return existing as AllowanceRecord;
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
