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

    // Get query params
    const url = new URL(req.url);
    const serverId = url.searchParams.get("server_id");
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 20) : 5;

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

    // Fetch recent activity for this server
    const { data: activities, error: activitiesError } = await supabase
      .from("server_activity")
      .select("query, source, user_name, channel_name, created_at")
      .eq("server_id", serverId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (activitiesError) {
      console.error("Activity fetch error:", activitiesError);
      return new Response(JSON.stringify({ error: "Failed to fetch activity" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Fetched ${activities?.length || 0} activities for server ${serverId}`);

    return new Response(JSON.stringify({
      items: activities || [],
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
