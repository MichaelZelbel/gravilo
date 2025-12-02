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

    // Parse multipart form data
    const formData = await req.formData();
    const discordServerId = formData.get("discord_server_id") as string;
    const file = formData.get("file") as File;

    if (!discordServerId || !file) {
      return new Response(
        JSON.stringify({ error: "Missing discord_server_id or file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      .eq("discord_server_id", discordServerId)
      .maybeSingle();

    if (!serverAccess) {
      return new Response(
        JSON.stringify({ error: "Access denied to this server" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique file path
    const fileExt = file.name.split(".").pop() || "bin";
    const uniqueId = crypto.randomUUID();
    const filePath = `${discordServerId}/${uniqueId}.${fileExt}`;

    // Upload file to storage
    const { error: uploadError } = await supabaseClient.storage
      .from("kb-files")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload file", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert metadata
    const { data: metaData, error: metaError } = await supabaseClient
      .from("server_kb_files")
      .insert({
        discord_server_id: discordServerId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        status: "uploaded"
      })
      .select()
      .single();

    if (metaError) {
      console.error("Metadata error:", metaError);
      // Clean up uploaded file
      await supabaseClient.storage.from("kb-files").remove([filePath]);
      return new Response(
        JSON.stringify({ error: "Failed to save file metadata", details: metaError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`File uploaded: ${file.name} -> ${filePath}`);

    return new Response(
      JSON.stringify({ success: true, file: metaData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("KB upload error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
