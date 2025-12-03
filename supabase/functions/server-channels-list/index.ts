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

    // Get server_id from query params
    const url = new URL(req.url);
    const server_id = url.searchParams.get("server_id");

    if (!server_id) {
      return new Response(
        JSON.stringify({ error: "server_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching channels for server ${server_id} by user ${user.id}`);

    // Verify user owns this server (via servers table owner_id)
    const { data: serverData, error: serverError } = await supabase
      .from("servers")
      .select("id, discord_guild_id")
      .eq("id", server_id)
      .single();

    if (serverError || !serverData) {
      console.error("Server access denied:", serverError);
      return new Response(
        JSON.stringify({ error: "Access denied to this server" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch channels for this server
    const { data: channels, error: channelsError } = await supabase
      .from("server_channels")
      .select("id, name, type, position, allowed")
      .eq("server_id", server_id)
      .order("position", { ascending: true });

    if (channelsError) {
      console.error("Error fetching channels:", channelsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch channels" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map channel types to friendly names
    const channelTypeMap: Record<number, string> = {
      0: "text",
      2: "voice",
      4: "category",
      5: "announcement",
      10: "thread",
      11: "thread",
      12: "thread",
      13: "stage",
      15: "forum",
    };

    const mappedChannels = (channels || []).map((ch) => ({
      discord_channel_id: ch.id,
      discord_channel_name: ch.name,
      discord_channel_type: channelTypeMap[ch.type] || "unknown",
      type: ch.type,
      position: ch.position,
      allowed: ch.allowed ?? true,
    }));

    console.log(`Returning ${mappedChannels.length} channels`);

    return new Response(
      JSON.stringify({ channels: mappedChannels }),
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
