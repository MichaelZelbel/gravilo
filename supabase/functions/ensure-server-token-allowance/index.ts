import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AllowanceResult {
  id: string;
  server_id: string;
  tokens_granted: number;
  tokens_used: number;
  remaining_tokens: number;
  tokens_per_credit: number;
  credits_granted: number;
  credits_used: number;
  remaining_credits: number;
  period_start: string;
  period_end: string;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Service role client for database operations
    const supabaseAdmin: AnySupabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { server_id, batch_init } = body;

    // Get auth header for user validation
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let isAdmin = false;
    let isServiceRole = false;

    // Check if using service role key directly
    if (authHeader?.includes(supabaseServiceKey)) {
      isServiceRole = true;
    } else if (authHeader) {
      // Validate user auth
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

      // Check if user is admin
      const { data: adminCheck } = await supabaseAdmin
        .rpc("has_role", { _user_id: userId, _role: "admin" });
      isAdmin = adminCheck === true;
    }

    // Handle batch initialization (admin or service role only)
    if (batch_init) {
      if (!isAdmin && !isServiceRole) {
        return new Response(JSON.stringify({ error: "Admin access required for batch init" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await initializeAllServers(supabaseAdmin);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single server mode - validate server_id
    if (!server_id) {
      return new Response(JSON.stringify({ error: "server_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user access to server (unless admin or service role)
    if (!isAdmin && !isServiceRole) {
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hasAccess = await checkServerAccess(supabaseAdmin, userId, server_id);
      if (!hasAccess) {
        return new Response(JSON.stringify({ error: "Access denied to this server" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Ensure allowance for single server
    const allowance = await ensureServerAllowance(supabaseAdmin, server_id);
    
    return new Response(JSON.stringify(allowance), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in ensure-server-token-allowance:", error);
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

async function getAiCreditSettings(supabase: AnySupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("ai_credit_settings")
    .select("key, value_int");

  if (error) throw new Error(`Failed to get credit settings: ${error.message}`);

  const settings: Record<string, number> = {};
  for (const row of data || []) {
    settings[row.key] = row.value_int;
  }
  return settings;
}

async function getServerPlan(supabase: AnySupabaseClient, serverId: string): Promise<string> {
  // First get the server's internal id
  const { data: server } = await supabase
    .from("servers")
    .select("id")
    .eq("discord_guild_id", serverId)
    .maybeSingle();

  if (!server) return "free";

  // Then check server_plans
  const { data: plan } = await supabase
    .from("server_plans")
    .select("plan")
    .eq("server_id", server.id)
    .maybeSingle();

  return plan?.plan || "free";
}

function getCurrentPeriodDates(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { periodStart, periodEnd };
}

async function ensureServerAllowance(supabase: AnySupabaseClient, serverId: string): Promise<AllowanceResult> {
  const settings = await getAiCreditSettings(supabase);
  const tokensPerCredit = settings.tokens_per_credit || 200;
  
  const { periodStart, periodEnd } = getCurrentPeriodDates();

  // Check for existing current period
  const { data: existing } = await supabase
    .from("server_token_allowances")
    .select("*")
    .eq("server_id", serverId)
    .gte("period_end", new Date().toISOString())
    .lte("period_start", new Date().toISOString())
    .maybeSingle();

  if (existing) {
    return formatAllowanceResult(existing, tokensPerCredit);
  }

  // Get server plan and calculate tokens
  const plan = await getServerPlan(supabase, serverId);
  const baseTokens = plan === "premium" 
    ? (settings.tokens_premium_per_month || 600000)
    : (settings.tokens_free_per_month || 60000);

  // Check for previous period to calculate rollover
  let rolloverTokens = 0;
  const { data: previousPeriod } = await supabase
    .from("server_token_allowances")
    .select("*")
    .eq("server_id", serverId)
    .lt("period_end", periodStart.toISOString())
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousPeriod) {
    const previousRemaining = previousPeriod.tokens_granted - previousPeriod.tokens_used;
    // Rollover capped at base_tokens
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
      metadata: {
        base_tokens: baseTokens,
        rollover_tokens: rolloverTokens,
        plan: plan,
      },
    })
    .select()
    .single();

  if (insertError) {
    // Handle race condition - another request may have created it
    if (insertError.code === "23505") { // Unique violation
      const { data: racedPeriod } = await supabase
        .from("server_token_allowances")
        .select("*")
        .eq("server_id", serverId)
        .gte("period_end", new Date().toISOString())
        .lte("period_start", new Date().toISOString())
        .single();
      
      if (racedPeriod) {
        return formatAllowanceResult(racedPeriod, tokensPerCredit);
      }
    }
    throw new Error(`Failed to create allowance period: ${insertError.message}`);
  }

  console.log(`Created new allowance period for server ${serverId}: ${tokensGranted} tokens (base: ${baseTokens}, rollover: ${rolloverTokens})`);

  return formatAllowanceResult(newPeriod, tokensPerCredit);
}

function formatAllowanceResult(period: Record<string, unknown>, tokensPerCredit: number): AllowanceResult {
  const tokensGranted = Number(period.tokens_granted) || 0;
  const tokensUsed = Number(period.tokens_used) || 0;
  const remainingTokens = tokensGranted - tokensUsed;

  return {
    id: period.id as string,
    server_id: period.server_id as string,
    tokens_granted: tokensGranted,
    tokens_used: tokensUsed,
    remaining_tokens: remainingTokens,
    tokens_per_credit: tokensPerCredit,
    credits_granted: Math.floor(tokensGranted / tokensPerCredit),
    credits_used: Math.floor(tokensUsed / tokensPerCredit),
    remaining_credits: Math.floor(remainingTokens / tokensPerCredit),
    period_start: period.period_start as string,
    period_end: period.period_end as string,
    source: period.source as string,
    metadata: period.metadata as Record<string, unknown>,
    created_at: period.created_at as string,
    updated_at: period.updated_at as string,
  };
}

async function initializeAllServers(supabase: AnySupabaseClient): Promise<{ initialized: number; servers: string[] }> {
  // Get all active servers
  const { data: servers, error: serversError } = await supabase
    .from("servers")
    .select("discord_guild_id")
    .eq("active", true);

  if (serversError) throw new Error(`Failed to get servers: ${serversError.message}`);

  // Get servers that already have current period
  const { data: existingAllowances } = await supabase
    .from("server_token_allowances")
    .select("server_id")
    .gte("period_end", new Date().toISOString())
    .lte("period_start", new Date().toISOString());

  const existingServerIds = new Set((existingAllowances || []).map((a: { server_id: string }) => a.server_id));

  // Filter to servers needing initialization
  const serversToInit = (servers || [])
    .map((s: { discord_guild_id: string }) => s.discord_guild_id)
    .filter((id: string) => !existingServerIds.has(id));

  const initializedServers: string[] = [];

  for (const serverId of serversToInit) {
    try {
      await ensureServerAllowance(supabase, serverId);
      initializedServers.push(serverId);
    } catch (err) {
      console.error(`Failed to initialize server ${serverId}:`, err);
    }
  }

  console.log(`Batch init completed: ${initializedServers.length} servers initialized`);

  return {
    initialized: initializedServers.length,
    servers: initializedServers,
  };
}
