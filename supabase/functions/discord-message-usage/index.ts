import { serve } from "https://deno.land/std/http/server.ts";
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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Only POST allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const body = await req.json().catch(() => null);

  if (!body || !body.discord_guild_id) {
    return new Response(JSON.stringify({ error: "Missing discord_guild_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { discord_guild_id, messages = 1 } = body;

  console.log(`Processing usage for guild ${discord_guild_id}: ${messages} messages`);

  const { data: server, error: serverError } = await supabase
    .from("servers")
    .select("*")
    .eq("discord_guild_id", discord_guild_id)
    .single();

  if (serverError || !server) {
    console.error("Server not found:", serverError);
    return new Response(JSON.stringify({ error: "Server not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const today = new Date();
  const cycle_start = new Date(server.cycle_start);
  const cycle_end = new Date(server.cycle_end);

  // Check if cycle has expired
  if (today > cycle_end) {
    console.log(`Cycle expired for ${discord_guild_id}, resetting usage`);

    const new_cycle_start = new Date(today.getFullYear(), today.getMonth(), 1);
    const new_cycle_end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Reset the servers table with new cycle
    const { error: updateError } = await supabase
      .from("servers")
      .update({
        message_usage_current_cycle: messages,
        cycle_start: new_cycle_start.toISOString().split('T')[0],
        cycle_end: new_cycle_end.toISOString().split('T')[0],
      })
      .eq("id", server.id);

    if (updateError) {
      console.error("Failed to update server:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert new usage record for the new cycle
    const { error: insertError } = await supabase.from("server_usage").insert({
      server_id: server.id,
      discord_guild_id,
      messages,
      cycle_start: new_cycle_start.toISOString().split('T')[0],
      cycle_end: new_cycle_end.toISOString().split('T')[0],
    });

    if (insertError) {
      console.error("Failed to insert usage record:", insertError);
    }

    return new Response(JSON.stringify({ status: "reset", usage: messages, limit: server.message_limit }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Cycle is still active, increment usage
  const newUsage = server.message_usage_current_cycle + messages;

  console.log(`Incrementing usage for ${discord_guild_id}: ${server.message_usage_current_cycle} -> ${newUsage}`);

  const { error: updateError } = await supabase
    .from("servers")
    .update({
      message_usage_current_cycle: newUsage,
    })
    .eq("id", server.id);

  if (updateError) {
    console.error("Failed to update usage:", updateError);
    return new Response(JSON.stringify({ error: "Failed to update usage" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Upsert usage record
  const { error: upsertError } = await supabase.from("server_usage").upsert(
    {
      server_id: server.id,
      discord_guild_id,
      cycle_start: cycle_start.toISOString().split('T')[0],
      cycle_end: cycle_end.toISOString().split('T')[0],
      messages: newUsage,
    },
    { onConflict: "server_id, cycle_start" }
  );

  if (upsertError) {
    console.error("Failed to upsert usage record:", upsertError);
  }

  return new Response(JSON.stringify({ 
    status: "ok", 
    usage: newUsage, 
    limit: server.message_limit,
    remaining: server.message_limit - newUsage
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// Example bot usage:
// client.on("messageCreate", async (message) => {
//   if (!message.guild || message.author.bot) return;
//   await fetch("https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/discord-message-usage", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       discord_guild_id: message.guild.id,
//       messages: 1
//     })
//   });
// });
