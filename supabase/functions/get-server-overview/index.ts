import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const server_id = url.searchParams.get("server_id");

    if (!server_id) {
      return new Response(
        JSON.stringify({ error: "server_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching overview for server ${server_id} by user ${user.id}`);

    // Fetch server info (RLS will ensure user owns this server)
    const { data: serverData, error: serverError } = await supabase
      .from("servers")
      .select("id, name, icon_url, discord_guild_id, bot_nickname, message_usage_current_cycle, message_limit, cycle_start, cycle_end, active")
      .eq("id", server_id)
      .single();

    if (serverError) {
      console.error("Server fetch error:", serverError);
      return new Response(
        JSON.stringify({ error: "Server not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch server plan (may not exist yet)
    const { data: planData } = await supabase
      .from("server_plans")
      .select("plan")
      .eq("server_id", server_id)
      .maybeSingle();

    // Fetch server settings
    const { data: settingsData } = await supabase
      .from("server_settings")
      .select("custom_personality_prompt, behavior_mode, use_knowledge_base, allow_proactive_replies, allow_fun_replies")
      .eq("server_id", server_id)
      .maybeSingle();

    // Fetch latest usage record for current cycle
    const { data: usageData } = await supabase
      .from("server_usage")
      .select("messages, cycle_start, cycle_end")
      .eq("server_id", server_id)
      .order("cycle_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Build response with defaults
    const response = {
      server: {
        id: serverData.id,
        name: serverData.name,
        icon_url: serverData.icon_url,
        discord_guild_id: serverData.discord_guild_id,
        bot_nickname: serverData.bot_nickname || "Gravilo",
        active: serverData.active,
      },
      plan: planData?.plan || "free",
      usage: {
        messages_used: serverData.message_usage_current_cycle || 0,
        messages_cap: serverData.message_limit || 3000,
        cycle_start: serverData.cycle_start,
        cycle_end: serverData.cycle_end,
      },
      settings: {
        custom_personality_prompt: settingsData?.custom_personality_prompt || "",
        behavior_mode: settingsData?.behavior_mode || "quiet",
        use_knowledge_base: settingsData?.use_knowledge_base ?? true,
        allow_proactive_replies: settingsData?.allow_proactive_replies ?? false,
        allow_fun_replies: settingsData?.allow_fun_replies ?? true,
      },
    };

    console.log("Returning server overview:", JSON.stringify(response, null, 2));

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
