import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_PRESETS = ["helpful_assistant", "sarcastic_droid", "wise_wizard", "genz_gamer", "custom"];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create authenticated client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json();
    const { server_id, preset, custom_prompt } = body;

    if (!server_id) {
      return new Response(JSON.stringify({ error: "Missing server_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!preset || !VALID_PRESETS.includes(preset)) {
      return new Response(JSON.stringify({ error: "Invalid preset value" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's discord_user_id
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("discord_user_id")
      .eq("id", user.id)
      .maybeSingle();

    if (userDataError || !userData?.discord_user_id) {
      console.error("User data error:", userDataError);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has access to this server via user_servers
    const { data: access, error: accessError } = await supabase
      .from("user_servers")
      .select("id")
      .eq("discord_user_id", userData.discord_user_id)
      .eq("discord_server_id", server_id)
      .maybeSingle();

    if (accessError) {
      console.error("Access check error:", accessError);
      return new Response(JSON.stringify({ error: "Failed to verify access" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!access) {
      return new Response(JSON.stringify({ error: "Access denied to this server" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If preset is not "custom", set custom_prompt to null
    const finalCustomPrompt = preset === "custom" ? (custom_prompt || null) : null;

    console.log(`Upserting personality for server ${server_id}: preset=${preset}, custom_prompt=${finalCustomPrompt ? "provided" : "null"}`);

    // Upsert the personality row
    const { data: upsertedData, error: upsertError } = await supabase
      .from("server_personality")
      .upsert(
        {
          server_id,
          preset,
          custom_prompt: finalCustomPrompt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "server_id" }
      )
      .select("server_id, preset, custom_prompt")
      .single();

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to save personality" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Successfully saved personality for server ${server_id}`);

    // Return the saved data
    return new Response(JSON.stringify({
      server_id: upsertedData.server_id,
      preset: upsertedData.preset,
      custom_prompt: upsertedData.custom_prompt || "",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
