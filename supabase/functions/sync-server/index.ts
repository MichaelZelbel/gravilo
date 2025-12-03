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

    // Get auth token from request
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

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get server_id from query params (GET) or body (POST)
    let server_id: string | null = null;
    
    if (req.method === "GET") {
      const url = new URL(req.url);
      server_id = url.searchParams.get("server_id");
    } else if (req.method === "POST") {
      const body = await req.json();
      server_id = body.server_id || body.discord_server_id;
    }

    if (!server_id) {
      return new Response(
        JSON.stringify({ error: "server_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sync requested for server ${server_id} by user ${user.id}`);

    // Verify user owns this server (RLS check)
    const { data: serverData, error: serverError } = await supabase
      .from("servers")
      .select("id, discord_guild_id, name, icon_url, owner_id")
      .eq("id", server_id)
      .single();

    if (serverError || !serverData) {
      console.error("Server not found or access denied:", serverError);
      return new Response(
        JSON.stringify({ error: "Server not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Discord OAuth token from user's session
    const discordToken = user.user_metadata?.provider_token;
    
    if (!discordToken) {
      console.log("No Discord token available - using existing data");
      // Return existing data if no token
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No Discord token available. Please re-login with Discord to enable full sync.",
          server: serverData,
          channels: []
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const discord_guild_id = serverData.discord_guild_id;
    console.log(`Fetching Discord data for guild ${discord_guild_id}`);

    // Fetch guild info from Discord
    const guildResponse = await fetch(`https://discord.com/api/v10/guilds/${discord_guild_id}`, {
      headers: {
        "Authorization": `Bearer ${discordToken}`,
      },
    });

    if (!guildResponse.ok) {
      const errorText = await guildResponse.text();
      console.error(`Discord guild fetch failed: ${guildResponse.status} - ${errorText}`);
      
      // If 401/403, the user may not have access to this guild or token expired
      if (guildResponse.status === 401 || guildResponse.status === 403) {
        return new Response(
          JSON.stringify({ 
            error: "Discord access denied. Please re-login with Discord.",
            code: "DISCORD_AUTH_ERROR"
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to fetch guild from Discord" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const guildData = await guildResponse.json();
    console.log(`Guild data received: ${guildData.name}`);

    // Fetch channels from Discord
    const channelsResponse = await fetch(`https://discord.com/api/v10/guilds/${discord_guild_id}/channels`, {
      headers: {
        "Authorization": `Bearer ${discordToken}`,
      },
    });

    let channelsData: any[] = [];
    if (channelsResponse.ok) {
      channelsData = await channelsResponse.json();
      console.log(`Fetched ${channelsData.length} channels`);
    } else {
      console.error(`Failed to fetch channels: ${channelsResponse.status}`);
    }

    // Build icon URL
    const icon_url = guildData.icon 
      ? `https://cdn.discordapp.com/icons/${discord_guild_id}/${guildData.icon}.png`
      : null;

    // Update server metadata in database using service role for admin access
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: updatedServer, error: updateError } = await supabaseAdmin
      .from("servers")
      .update({
        name: guildData.name,
        icon_url: icon_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", server_id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating server:", updateError);
    }

    // Upsert channels - preserve 'allowed' field for existing channels
    if (channelsData.length > 0) {
      // First, get existing channel IDs to preserve their 'allowed' status
      const { data: existingChannels } = await supabaseAdmin
        .from("server_channels")
        .select("id, allowed")
        .eq("server_id", server_id);

      const existingAllowedMap = new Map(
        (existingChannels || []).map((ch: any) => [ch.id, ch.allowed])
      );

      const channelRecords = channelsData.map((ch: any) => ({
        id: ch.id,
        server_id: server_id,
        discord_guild_id: discord_guild_id,
        name: ch.name,
        type: ch.type,
        position: ch.position || 0,
        parent_id: ch.parent_id || null,
        nsfw: ch.nsfw || false,
        // Preserve existing 'allowed' status, default to true for new channels
        allowed: existingAllowedMap.has(ch.id) ? existingAllowedMap.get(ch.id) : true,
        updated_at: new Date().toISOString(),
      }));

      const { error: channelsError } = await supabaseAdmin
        .from("server_channels")
        .upsert(channelRecords, { 
          onConflict: "id",
          ignoreDuplicates: false 
        });

      if (channelsError) {
        console.error("Error upserting channels:", channelsError);
      } else {
        console.log(`Upserted ${channelRecords.length} channels`);
      }
    }

    // Fetch the updated channels list to return
    const { data: savedChannels } = await supabaseAdmin
      .from("server_channels")
      .select("*")
      .eq("server_id", server_id)
      .order("position", { ascending: true });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Server synced successfully",
        server: updatedServer || serverData,
        channels: savedChannels || []
      }),
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
