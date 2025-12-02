/**
 * Public API endpoint for Discord bot / n8n to query server settings
 * 
 * GET /get-server-settings-api?server_id=DISCORD_SERVER_ID
 * 
 * Requires x-bot-secret header for authentication
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-secret",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Only GET allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify bot secret for authentication
  const botSecret = req.headers.get("x-bot-secret");
  const expectedSecret = Deno.env.get("DISCORD_BOT_SYNC_SECRET");

  if (!expectedSecret || botSecret !== expectedSecret) {
    console.error("[GET-SERVER-SETTINGS-API] Unauthorized request: invalid or missing x-bot-secret");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const serverId = url.searchParams.get("server_id");

    if (!serverId) {
      return new Response(
        JSON.stringify({ error: "server_id query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[GET-SERVER-SETTINGS-API] Fetching settings for server:", serverId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First, try to find by discord_server_id
    let { data: settings, error } = await supabase
      .from("server_settings")
      .select(`
        personality_preset,
        custom_personality_prompt,
        enable_moderation,
        enable_kb_ingestion,
        use_knowledge_base,
        model_name,
        max_reply_tokens,
        behavior_mode,
        allow_fun_replies,
        allow_proactive_replies,
        updated_at
      `)
      .eq("discord_server_id", serverId)
      .maybeSingle();

    // If not found by discord_server_id, try via servers table
    if (!settings) {
      const { data: serverData } = await supabase
        .from("servers")
        .select("id")
        .eq("discord_guild_id", serverId)
        .maybeSingle();

      if (serverData) {
        const { data: settingsByServerId } = await supabase
          .from("server_settings")
          .select(`
            personality_preset,
            custom_personality_prompt,
            enable_moderation,
            enable_kb_ingestion,
            use_knowledge_base,
            model_name,
            max_reply_tokens,
            behavior_mode,
            allow_fun_replies,
            allow_proactive_replies,
            updated_at
          `)
          .eq("server_id", serverData.id)
          .maybeSingle();

        settings = settingsByServerId;
      }
    }

    if (error) {
      console.error("[GET-SERVER-SETTINGS-API] Database error:", error);
      return new Response(
        JSON.stringify({ error: "Database error", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return default settings if none found
    if (!settings) {
      console.log("[GET-SERVER-SETTINGS-API] No settings found, returning defaults");
      return new Response(
        JSON.stringify({
          personality_preset: "helpful",
          custom_personality_prompt: null,
          enable_moderation: false,
          enable_kb_ingestion: true,
          model_name: "gpt-4o-mini",
          max_reply_tokens: 500,
          behavior_mode: "quiet",
          allow_fun_replies: true,
          allow_proactive_replies: false,
          is_default: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[GET-SERVER-SETTINGS-API] Settings found for server:", serverId);

    return new Response(
      JSON.stringify({
        personality_preset: settings.personality_preset || "helpful",
        custom_personality_prompt: settings.custom_personality_prompt,
        enable_moderation: settings.enable_moderation ?? false,
        enable_kb_ingestion: settings.enable_kb_ingestion ?? settings.use_knowledge_base ?? true,
        model_name: settings.model_name || "gpt-4o-mini",
        max_reply_tokens: settings.max_reply_tokens ?? 500,
        behavior_mode: settings.behavior_mode || "quiet",
        allow_fun_replies: settings.allow_fun_replies ?? true,
        allow_proactive_replies: settings.allow_proactive_replies ?? false,
        updated_at: settings.updated_at,
        is_default: false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[GET-SERVER-SETTINGS-API] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
