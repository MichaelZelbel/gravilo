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
 *         headers: { "Content-Type": "application/json" },
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  console.log("Discord Guild Sync: Request received");

  // Initialize Supabase client with service role key for admin access
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables");
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
    console.error("Invalid JSON body:", error);
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

  if (!discord_guild_id || !discord_owner_id || !name) {
    console.error("Missing required fields:", { discord_guild_id, discord_owner_id, name });
    return new Response(
      JSON.stringify({ 
        error: "Missing required fields",
        required: ["discord_guild_id", "discord_owner_id", "name"]
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log("Syncing guild:", { discord_guild_id, discord_owner_id, name });

  // Step 1: Find or create user based on discord_owner_id
  const { data: existingUser, error: userSelectError } = await supabase
    .from("users")
    .select("id, discord_user_id, plan")
    .eq("discord_user_id", discord_owner_id)
    .maybeSingle();

  if (userSelectError) {
    console.error("User lookup error:", userSelectError);
    return new Response(
      JSON.stringify({ error: "User lookup failed", details: userSelectError.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let userId = existingUser?.id;

  // Create user if doesn't exist
  if (!userId) {
    console.log("Creating new user for discord_owner_id:", discord_owner_id);
    
    const { data: newUser, error: userInsertError } = await supabase
      .from("users")
      .insert({
        discord_user_id: discord_owner_id,
        plan: "free",
      })
      .select("id")
      .single();

    if (userInsertError || !newUser) {
      console.error("User creation error:", userInsertError);
      return new Response(
        JSON.stringify({ error: "Failed to create user", details: userInsertError?.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    userId = newUser.id;
    console.log("Created user with id:", userId);
  } else {
    console.log("Found existing user with id:", userId);
  }

  // Step 2: Upsert server data
  console.log("Upserting server for guild:", discord_guild_id);

  const { data: serverRow, error: serverError } = await supabase
    .from("servers")
    .upsert(
      {
        discord_guild_id,
        owner_id: userId,
        name,
        icon_url: icon_url ?? null,
        message_limit: message_limit ?? 3000,
        active: true,
      },
      { 
        onConflict: "discord_guild_id",
        ignoreDuplicates: false // Always update on conflict
      }
    )
    .select("id, name, message_limit, active")
    .single();

  if (serverError || !serverRow) {
    console.error("Server upsert error:", serverError);
    return new Response(
      JSON.stringify({ error: "Failed to upsert server", details: serverError?.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log("Server synced successfully:", serverRow.id);

  // Return success response
  return new Response(
    JSON.stringify({
      status: "ok",
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
