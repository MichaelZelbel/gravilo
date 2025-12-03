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
    // Get auth token from header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse query params
    const url = new URL(req.url);
    const serverId = url.searchParams.get("server_id");

    if (!serverId) {
      return new Response(
        JSON.stringify({ error: "Missing server_id parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's token
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user session
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to this server via user_servers table
    const { data: userData } = await supabaseClient
      .from("users")
      .select("discord_user_id")
      .eq("id", user.id)
      .single();

    if (!userData?.discord_user_id) {
      return new Response(
        JSON.stringify({ error: "User has no Discord ID linked" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: serverAccess } = await supabaseClient
      .from("user_servers")
      .select("id")
      .eq("discord_user_id", userData.discord_user_id)
      .eq("discord_server_id", serverId)
      .maybeSingle();

    if (!serverAccess) {
      return new Response(
        JSON.stringify({ error: "Access denied to this server" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query server_kb_files for this discord_server_id
    const { data: files, error: filesError } = await supabaseClient
      .from("server_kb_files")
      .select("id, discord_server_id, file_name, file_path, file_size, status, num_chunks, duration_ms, error_message, created_at")
      .eq("discord_server_id", serverId)
      .order("created_at", { ascending: false });

    if (filesError) {
      console.error("Error fetching KB files:", filesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch files", details: filesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[KB-LIST] Returning ${files?.length || 0} files for server ${serverId}`);

    return new Response(
      JSON.stringify({ files: files || [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("KB list error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
