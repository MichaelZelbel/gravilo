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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { server_id, discord_channel_id, allowed } = body;

    if (!server_id || !discord_channel_id || typeof allowed !== "boolean") {
      return new Response(
        JSON.stringify({ error: "server_id, discord_channel_id, and allowed (boolean) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating channel ${discord_channel_id} for server ${server_id}, allowed=${allowed}`);

    // Verify user owns this server
    const { data: serverData, error: serverError } = await supabase
      .from("servers")
      .select("id")
      .eq("id", server_id)
      .single();

    if (serverError || !serverData) {
      console.error("Server access denied:", serverError);
      return new Response(
        JSON.stringify({ error: "Access denied to this server" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the channel's allowed status
    const { error: updateError } = await supabase
      .from("server_channels")
      .update({ allowed })
      .eq("id", discord_channel_id)
      .eq("server_id", server_id);

    if (updateError) {
      console.error("Error updating channel:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update channel" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Channel ${discord_channel_id} updated successfully`);

    return new Response(
      JSON.stringify({ success: true }),
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
