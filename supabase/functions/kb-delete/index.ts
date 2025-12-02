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

    // Parse request body
    const { file_id } = await req.json();

    if (!file_id) {
      return new Response(
        JSON.stringify({ error: "Missing file_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get file metadata first
    const { data: fileData, error: fileError } = await supabaseClient
      .from("server_kb_files")
      .select("*")
      .eq("id", file_id)
      .single();

    if (fileError || !fileData) {
      return new Response(
        JSON.stringify({ error: "File not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to this server
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
      .eq("discord_server_id", fileData.discord_server_id)
      .maybeSingle();

    if (!serverAccess) {
      return new Response(
        JSON.stringify({ error: "Access denied to this server" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete from storage
    const { error: storageError } = await supabaseClient.storage
      .from("kb-files")
      .remove([fileData.file_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      // Continue anyway to delete metadata
    }

    // Delete metadata
    const { error: deleteError } = await supabaseClient
      .from("server_kb_files")
      .delete()
      .eq("id", file_id);

    if (deleteError) {
      console.error("Metadata delete error:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete file metadata", details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`File deleted: ${fileData.file_name} (${file_id})`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("KB delete error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
