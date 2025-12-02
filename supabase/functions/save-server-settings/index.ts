import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      server_id,
      custom_personality_prompt,
      behavior_mode,
      use_knowledge_base,
      allow_proactive_replies,
      allow_fun_replies,
    } = body;

    if (!server_id) {
      return new Response(JSON.stringify({ error: "Missing server_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    // Upsert settings with behavior flags
    const { data, error } = await supabase
      .from("server_settings")
      .upsert(
        {
          server_id,
          user_id: user.id,
          custom_personality_prompt: custom_personality_prompt ?? null,
          behavior_mode: behavior_mode ?? "quiet",
          use_knowledge_base: typeof use_knowledge_base === "boolean" ? use_knowledge_base : true,
          allow_proactive_replies: typeof allow_proactive_replies === "boolean" ? allow_proactive_replies : false,
          allow_fun_replies: typeof allow_fun_replies === "boolean" ? allow_fun_replies : true,
          updated_at: now,
        },
        { onConflict: "server_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Error saving settings:", error);
      return new Response(JSON.stringify({ error: "Failed to save settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, settings: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("save-server-settings error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
