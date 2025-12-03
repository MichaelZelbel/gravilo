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

    // Get server_id from query params
    const url = new URL(req.url);
    const serverId = url.searchParams.get("server_id");
    if (!serverId) {
      return new Response(JSON.stringify({ error: "Missing server_id parameter" }), {
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
      .eq("discord_server_id", serverId)
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

    // Fetch personality for this server
    const { data: personality, error: personalityError } = await supabase
      .from("server_personality")
      .select("server_id, preset, custom_prompt")
      .eq("server_id", serverId)
      .maybeSingle();

    if (personalityError) {
      console.error("Personality fetch error:", personalityError);
      return new Response(JSON.stringify({ error: "Failed to fetch personality" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return default if no row exists
    if (!personality) {
      console.log(`No personality found for server ${serverId}, returning default`);
      return new Response(JSON.stringify({
        server_id: serverId,
        preset: "helpful_assistant",
        custom_prompt: "",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return existing personality
    return new Response(JSON.stringify({
      server_id: personality.server_id,
      preset: personality.preset,
      custom_prompt: personality.custom_prompt || "",
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
