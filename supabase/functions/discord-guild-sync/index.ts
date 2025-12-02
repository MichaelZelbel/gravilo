/**
 * Discord Guild Sync Edge Function
 * 
 * This function is called by your Discord bot when it's added to a new server
 * or when server information needs to be updated.
 * 
 * Example Discord bot usage (Node.js/TypeScript):
 * 
 * ```typescript
 * import { Client, GatewayIntentBits } from 'discord.js';
 * 
 * const client = new Client({
 *   intents: [GatewayIntentBits.Guilds]
 * });
 * 
 * // When bot is added to a server
 * client.on("guildCreate", async (guild) => {
 *   try {
 *     const response = await fetch(
 *       "https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/discord-guild-sync",
 *       {
 *         method: "POST",
 *         headers: { 
 *           "Content-Type": "application/json",
 *           "x-bot-secret": process.env.DISCORD_BOT_SYNC_SECRET,
 *         },
 *         body: JSON.stringify({
 *           discord_guild_id: guild.id,
 *           discord_owner_id: guild.ownerId,
 *           name: guild.name,
 *           icon_url: guild.iconURL() || null,
 *           message_limit: 3000, // optional
 *         }),
 *       }
 *     );
 *     
 *     const data = await response.json();
 *     console.log("Server synced:", data);
 *   } catch (error) {
 *     console.error("Failed to sync server:", error);
 *   }
 * });
 * 
 * // You can also call this on guildUpdate to update server info
 * client.on("guildUpdate", async (oldGuild, newGuild) => {
 *   // Same fetch call as above with updated guild info
 * });
 * ```
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-secret',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }), 
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log("[DISCORD-GUILD-SYNC] Request received");

  // Verify bot secret
  const botSecret = req.headers.get("x-bot-secret");
  const expectedSecret = Deno.env.get("DISCORD_BOT_SYNC_SECRET");

  if (!expectedSecret || botSecret !== expectedSecret) {
    console.error("[DISCORD-GUILD-SYNC] Invalid or missing bot secret");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Initialize Supabase client with service role key for admin access
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error("[DISCORD-GUILD-SYNC] Missing Supabase environment variables");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Parse request body
  let body;
  try {
    body = await req.json();
  } catch (error) {
    console.error("[DISCORD-GUILD-SYNC] Invalid JSON body:", error);
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Validate required fields
  const { discord_guild_id, discord_owner_id, name, icon_url, message_limit } = body;

  if (!discord_guild_id || !name) {
    console.error("[DISCORD-GUILD-SYNC] Missing required fields:", { discord_guild_id, name });
    return new Response(
      JSON.stringify({ 
        error: "Missing required fields",
        required: ["discord_guild_id", "name"]
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log("[DISCORD-GUILD-SYNC] Syncing guild:", { discord_guild_id, discord_owner_id, name });

  // Step 1: Find user based on discord_owner_id (if provided)
  let ownerId: string | null = null;

  if (discord_owner_id) {
    const { data: existingUser, error: userSelectError } = await supabase
      .from("users")
      .select("id, discord_user_id, plan")
      .eq("discord_user_id", discord_owner_id)
      .maybeSingle();

    if (userSelectError) {
      console.error("[DISCORD-GUILD-SYNC] User lookup error:", userSelectError);
    } else if (existingUser) {
      ownerId = existingUser.id;
      console.log("[DISCORD-GUILD-SYNC] Found existing user with id:", ownerId);
    } else {
      console.log("[DISCORD-GUILD-SYNC] No user found for discord_owner_id:", discord_owner_id);
    }
  }

  // Step 2: Check if server already exists
  const { data: existingServer, error: serverSelectError } = await supabase
    .from("servers")
    .select("id, owner_id")
    .eq("discord_guild_id", discord_guild_id)
    .maybeSingle();

  if (serverSelectError) {
    console.error("[DISCORD-GUILD-SYNC] Server lookup error:", serverSelectError);
  }

  // Use existing owner_id if server exists and we didn't find a new owner
  if (existingServer && !ownerId) {
    ownerId = existingServer.owner_id;
  }

  // If still no owner, we need to create a placeholder user or skip owner assignment
  if (!ownerId && discord_owner_id) {
    console.log("[DISCORD-GUILD-SYNC] Creating placeholder user for discord_owner_id:", discord_owner_id);
    
    const { data: newUser, error: userInsertError } = await supabase
      .from("users")
      .insert({
        discord_user_id: discord_owner_id,
        plan: "free",
      })
      .select("id")
      .single();

    if (userInsertError || !newUser) {
      console.error("[DISCORD-GUILD-SYNC] User creation error:", userInsertError);
    } else {
      ownerId = newUser.id;
      console.log("[DISCORD-GUILD-SYNC] Created user with id:", ownerId);
    }
  }

  if (!ownerId) {
    console.error("[DISCORD-GUILD-SYNC] Unable to determine owner for server");
    return new Response(
      JSON.stringify({ error: "Unable to determine server owner" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Step 3: Upsert server data
  console.log("[DISCORD-GUILD-SYNC] Upserting server for guild:", discord_guild_id);

  const { data: serverRow, error: serverError } = await supabase
    .from("servers")
    .upsert(
      {
        discord_guild_id,
        owner_id: ownerId,
        name,
        icon_url: icon_url ?? null,
        message_limit: message_limit ?? 3000,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { 
        onConflict: "discord_guild_id",
        ignoreDuplicates: false
      }
    )
    .select("id, name, message_limit, active")
    .single();

  if (serverError || !serverRow) {
    console.error("[DISCORD-GUILD-SYNC] Server upsert error:", serverError);
    return new Response(
      JSON.stringify({ error: "Failed to upsert server", details: serverError?.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log("[DISCORD-GUILD-SYNC] Server synced successfully:", serverRow.id);

  // Return success response
  return new Response(
    JSON.stringify({
      success: true,
      server_id: serverRow.id,
      message: "Server synced successfully",
      data: {
        server_name: serverRow.name,
        message_limit: serverRow.message_limit,
        active: serverRow.active,
      }
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
