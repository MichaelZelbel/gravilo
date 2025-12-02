/**
 * Discord Server Disconnected Edge Function
 * 
 * This function is called by your Discord bot when it's removed from a server (guildDelete).
 * It marks the server as disconnected but keeps the data for historical purposes.
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
 * // When bot is removed from a server
 * client.on("guildDelete", async (guild) => {
 *   try {
 *     const response = await fetch(
 *       "https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/discord-server-disconnected",
 *       {
 *         method: "POST",
 *         headers: { 
 *           "Content-Type": "application/json",
 *           "x-bot-secret": process.env.DISCORD_BOT_SYNC_SECRET,
 *         },
 *         body: JSON.stringify({
 *           discord_guild_id: guild.id,
 *         }),
 *       }
 *     );
 *     
 *     const data = await response.json();
 *     console.log("Server disconnected:", data);
 *   } catch (error) {
 *     console.error("Failed to mark server disconnected:", error);
 *   }
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

  console.log("[DISCORD-SERVER-DISCONNECTED] Request received");

  // Verify bot secret
  const botSecret = req.headers.get("x-bot-secret");
  const expectedSecret = Deno.env.get("DISCORD_BOT_SYNC_SECRET");

  if (!expectedSecret || botSecret !== expectedSecret) {
    console.error("[DISCORD-SERVER-DISCONNECTED] Invalid or missing bot secret");
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
    console.error("[DISCORD-SERVER-DISCONNECTED] Missing Supabase environment variables");
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
    console.error("[DISCORD-SERVER-DISCONNECTED] Invalid JSON body:", error);
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Validate required fields
  const { discord_guild_id } = body;

  if (!discord_guild_id) {
    console.error("[DISCORD-SERVER-DISCONNECTED] Missing discord_guild_id");
    return new Response(
      JSON.stringify({ error: "Missing discord_guild_id" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log("[DISCORD-SERVER-DISCONNECTED] Marking server as disconnected:", discord_guild_id);

  // Update server to mark as disconnected (active = false)
  const { data: serverRow, error: updateError } = await supabase
    .from("servers")
    .update({
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("discord_guild_id", discord_guild_id)
    .select("id, name")
    .maybeSingle();

  if (updateError) {
    console.error("[DISCORD-SERVER-DISCONNECTED] Update error:", updateError);
    return new Response(
      JSON.stringify({ error: "Failed to mark server disconnected", details: updateError.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (!serverRow) {
    console.log("[DISCORD-SERVER-DISCONNECTED] Server not found:", discord_guild_id);
    return new Response(
      JSON.stringify({ success: true, message: "Server not found, nothing to update" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log("[DISCORD-SERVER-DISCONNECTED] Server marked as disconnected:", serverRow.id);

  return new Response(
    JSON.stringify({
      success: true,
      server_id: serverRow.id,
      message: "Server marked as disconnected",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
