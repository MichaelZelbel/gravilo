import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-secret",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate secret
    const secret = req.headers.get("x-n8n-secret");
    const expectedSecret = Deno.env.get("N8N_INGESTION_SECRET");
    
    if (!secret || secret !== expectedSecret) {
      console.error("Unauthorized: Invalid or missing x-n8n-secret header");
      return new Response("Unauthorized", { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // Parse request body
    const payload = await req.json();
    const { file_id, discord_server_id, status, num_chunks, duration_ms, error } = payload;

    if (!file_id || !status) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: file_id, status" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Ingestion complete callback for file ${file_id}: status=${status}, num_chunks=${num_chunks}, duration_ms=${duration_ms}`);

    // Create admin client to update status (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Build update object
    const updateData: Record<string, unknown> = {
      status: status
    };

    if (num_chunks !== undefined && num_chunks !== null) {
      updateData.num_chunks = num_chunks;
    }

    if (duration_ms !== undefined && duration_ms !== null) {
      updateData.duration_ms = duration_ms;
    }

    if (error !== undefined && error !== null) {
      updateData.error_message = error;
    }

    // Update the file record
    const { error: updateError } = await supabaseAdmin
      .from("server_kb_files")
      .update(updateData)
      .eq("id", file_id);

    if (updateError) {
      console.error("Failed to update server_kb_files:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update file status", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully updated file ${file_id} to status: ${status}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("KB ingestion-complete error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
