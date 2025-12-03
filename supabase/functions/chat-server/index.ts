import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Supabase client for user auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body - accept server_id (discord_guild_id), query, channel_name
    const { server_id, query, channel_name } = await req.json();

    if (!server_id || !query) {
      return new Response(JSON.stringify({ error: "Missing server_id or query" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's discord_user_id from users table
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("discord_user_id")
      .eq("id", user.id)
      .single();

    if (userDataError || !userData?.discord_user_id) {
      console.error("User data error:", userDataError);
      return new Response(JSON.stringify({ error: "User not linked to Discord" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user has access to this server via user_servers table
    const { data: serverAccess, error: accessError } = await supabase
      .from("user_servers")
      .select("id")
      .eq("discord_user_id", userData.discord_user_id)
      .eq("discord_server_id", server_id)
      .maybeSingle();

    // Also check if user owns the server directly via servers table
    const { data: ownedServer, error: ownedError } = await supabase
      .from("servers")
      .select("id")
      .eq("owner_id", user.id)
      .eq("discord_guild_id", server_id)
      .maybeSingle();

    if ((accessError && ownedError) || (!serverAccess && !ownedServer)) {
      console.log("Access denied for user", user.id, "to server", server_id);
      return new Response(JSON.stringify({ error: "Access denied to this server" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get n8n webhook URL from environment
    const n8nChatWebhookUrl = Deno.env.get("N8N_CHAT_WEBHOOK_URL");
    if (!n8nChatWebhookUrl) {
      console.error("N8N_CHAT_WEBHOOK_URL not configured");
      return new Response(JSON.stringify({ error: "Chat service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build payload for n8n - matches expected format from Webhook node
    // The n8n Config node maps: content, supabase_user_id, channel_name, server_id
    const n8nPayload = {
      content: query,
      supabase_user_id: user.id,
      channel_name: channel_name || "dashboard",
      server_id: server_id,
    };

    console.log("Calling n8n chat webhook for server:", server_id, "channel:", channel_name);

    // Send request to n8n
    const n8nResponse = await fetch(n8nChatWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(n8nPayload),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error("n8n error:", n8nResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to get response from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // n8n returns plain text from Respond to Webhook node (responseBody = {{$json.output}})
    const answerText = await n8nResponse.text();
    console.log("n8n response received, length:", answerText.length);

    // Return the answer wrapped in JSON for frontend
    return new Response(JSON.stringify({ answer: answerText || "No response from Gravilo" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Chat server error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
