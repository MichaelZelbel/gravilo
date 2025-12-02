import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Shield, Settings, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Server = {
  id: string;
  name: string;
  icon_url: string | null;
  message_usage_current_cycle: number;
  message_limit: number;
  bot_nickname: string;
  cycle_start: string;
  cycle_end: string;
  active: boolean;
};

type ServerOverview = {
  server: {
    id: string;
    name: string;
    icon_url: string | null;
    discord_guild_id: string;
    bot_nickname: string;
    active: boolean;
  };
  plan: "free" | "premium";
  usage: {
    messages_used: number;
    messages_cap: number;
    cycle_start: string;
    cycle_end: string;
  };
  settings: {
    custom_personality_prompt: string;
    behavior_mode: "quiet" | "normal" | "active";
    use_knowledge_base: boolean;
    allow_proactive_replies: boolean;
    allow_fun_replies: boolean;
  };
};

const Dashboard = () => {
  const [session, setSession] = useState<any>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  
  // Server overview state (replaces individual state vars)
  const [serverOverview, setServerOverview] = useState<ServerOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Local state for editing (bound to form inputs)
  const [customPrompt, setCustomPrompt] = useState("");
  const [behaviorMode, setBehaviorMode] = useState<"quiet" | "normal" | "active">("quiet");
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);
  const [allowProactiveReplies, setAllowProactiveReplies] = useState(false);
  const [allowFunReplies, setAllowFunReplies] = useState(true);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check for upgrade success in URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgrade") === "success") {
      setShowSuccessBanner(true);
      window.history.replaceState({}, "", "/dashboard");
      setTimeout(() => setShowSuccessBanner(false), 5000);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      // Check if we're in Lovable preview environment
      const isLovablePreview = window.location.hostname.includes('lovable.app') || 
                               window.location.hostname.includes('localhost');
      
      // Automatically bypass auth check in development/preview mode
      if (import.meta.env.DEV || isLovablePreview) {
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/";
        return;
      }

      setSession(session);

      // Get Discord user ID from auth metadata
      const discordUserId =
        session.user.user_metadata?.provider_id ||
        session.user.user_metadata?.sub ||
        null;

      // Fetch or create user row with discord_user_id
      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("id, plan, discord_user_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (userError) {
        console.error("Error loading user row", userError);
      }

      if (!userRow) {
        const { error: newUserError } = await supabase
          .from("users")
          .insert({
            id: session.user.id,
            email: session.user.email,
            discord_user_id: discordUserId,
            plan: "free",
          })
          .select("id, plan, discord_user_id")
          .single();

        if (newUserError) {
          console.error("Error creating user row", newUserError);
        }
      } else if (discordUserId && userRow.discord_user_id !== discordUserId) {
        // Update discord_user_id if it changed or was missing
        await supabase
          .from("users")
          .update({ discord_user_id: discordUserId })
          .eq("id", session.user.id);
      }

      // Check if user is admin
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      setIsAdmin(!!adminRole);

      // Get the user's discord_user_id for server filtering
      const userDiscordId = userRow?.discord_user_id || discordUserId;

      if (userDiscordId) {
        // Auto-claim servers: find servers where owner_discord_id matches and upsert into user_servers
        const { data: ownedServers } = await supabase
          .from("servers")
          .select("discord_guild_id")
          .eq("owner_discord_id", userDiscordId);

        if (ownedServers && ownedServers.length > 0) {
          const mappings = ownedServers.map(s => ({
            discord_user_id: userDiscordId,
            discord_server_id: s.discord_guild_id,
          }));
          
          // Upsert mappings (ignore duplicates)
          await supabase
            .from("user_servers")
            .upsert(mappings, { onConflict: "discord_user_id,discord_server_id", ignoreDuplicates: true });
        }

        // Fetch servers the user has access to via user_servers
        const { data: userServerMappings } = await supabase
          .from("user_servers")
          .select("discord_server_id")
          .eq("discord_user_id", userDiscordId);

        if (userServerMappings && userServerMappings.length > 0) {
          const serverIds = userServerMappings.map(m => m.discord_server_id);
          
          const { data: serversData, error: serversError } = await supabase
            .from("servers")
            .select("id, name, icon_url, discord_guild_id, bot_nickname, message_usage_current_cycle, message_limit, cycle_start, cycle_end, active")
            .in("discord_guild_id", serverIds)
            .order("active", { ascending: false })
            .order("name", { ascending: true });

          if (serversError) {
            console.error("Error loading servers", serversError);
          } else {
            setServers(serversData || []);
            if (serversData && serversData.length > 0) {
              setSelectedServerId(serversData[0].id);
            }
          }
        } else {
          setServers([]);
        }
      } else {
        // No discord_user_id, show empty state
        setServers([]);
      }

      setLoading(false);
    };

    init();
  }, []);

  // Load server overview when selected server changes
  useEffect(() => {
    const loadOverview = async () => {
      if (!selectedServerId || !session) return;
      
      setLoadingOverview(true);

      try {
        const url = `https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/get-server-overview?server_id=${selectedServerId}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data: ServerOverview = await response.json();
          setServerOverview(data);
          
          // Populate form state from overview
          setCustomPrompt(data.settings.custom_personality_prompt || "");
          setBehaviorMode(data.settings.behavior_mode || "quiet");
          setUseKnowledgeBase(data.settings.use_knowledge_base ?? true);
          setAllowProactiveReplies(data.settings.allow_proactive_replies ?? false);
          setAllowFunReplies(data.settings.allow_fun_replies ?? true);
        } else {
          console.error("Failed to load server overview");
          setServerOverview(null);
          // Reset form state
          setCustomPrompt("");
          setBehaviorMode("quiet");
          setUseKnowledgeBase(true);
          setAllowProactiveReplies(false);
          setAllowFunReplies(true);
        }
      } catch (err) {
        console.error("Error loading overview:", err);
        setServerOverview(null);
      }

      setLoadingOverview(false);
    };

    loadOverview();
  }, [selectedServerId, session]);

  const handleUpgrade = async () => {
    if (!selectedServerId) {
      alert("Please select a server first.");
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.href = "/";
        return;
      }

      // Use server-specific checkout
      const url = `https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/create-server-checkout?server_id=${selectedServerId}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error creating checkout:", errorData);
        alert("Failed to create checkout session. Please try again.");
        return;
      }

      const data = await response.json();
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("An error occurred. Please try again.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleSaveSettings = async () => {
    if (!selectedServerId || !session) return;
    
    setSavingPrompt(true);

    try {
      const url = `https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/save-server-settings`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          server_id: selectedServerId,
          custom_personality_prompt: customPrompt,
          behavior_mode: behaviorMode,
          use_knowledge_base: useKnowledgeBase,
          allow_proactive_replies: allowProactiveReplies,
          allow_fun_replies: allowFunReplies,
        }),
      });

      if (response.ok) {
        console.log("Settings saved successfully");
      } else {
        console.error("Failed to save settings");
      }
    } catch (err) {
      console.error("Error saving settings:", err);
    }

    setSavingPrompt(false);
  };

  const handleSyncServer = async () => {
    if (!selectedServerId || !session) return;
    
    setSyncing(true);

    try {
      const url = `https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/sync-server?server_id=${selectedServerId}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Sync response:", data);
        // Could show a toast here
      } else {
        console.error("Sync failed");
      }
    } catch (err) {
      console.error("Sync error:", err);
    }

    setSyncing(false);
  };

  // Derived values from serverOverview
  const serverPlan = serverOverview?.plan || "free";
  const usage = serverOverview?.usage.messages_used ?? 0;
  const limit = serverOverview?.usage.messages_cap ?? 3000;
  const cycleEnd = serverOverview?.usage.cycle_end ? new Date(serverOverview.usage.cycle_end) : null;
  const cycleEndFormatted = cycleEnd ? cycleEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
  const usagePercent = limit > 0 ? Math.min((usage / limit) * 100, 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050814] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full border-4 border-[#5865F2] border-t-transparent animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!import.meta.env.DEV && servers.length === 0) {
    return (
      <div className="min-h-screen bg-[#050814] text-white">
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_rgba(88,101,242,0.3),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,255,182,0.2),_transparent_60%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-20 bg-[linear-gradient(to_right,_rgba(255,255,255,0.08)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.08)_1px,_transparent_1px)] bg-[size:80px_80px]" />

          <div className="relative z-10 flex flex-col min-h-screen px-6 py-6 md:px-10 md:py-8">
            <header className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-4 md:px-6 py-3 flex items-center justify-between shadow-[0_0_30px_rgba(0,0,0,0.6)]">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#5865F2] to-[#3BFFB6] flex items-center justify-center text-sm font-bold">
                  G
                </div>
                <span className="font-semibold tracking-wide">Gravilo Dashboard</span>
              </div>

              <button
                onClick={handleLogout}
                className="text-xs sm:text-sm px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition"
              >
                Logout
              </button>
            </header>

            <div className="flex-1 flex items-center justify-center">
              <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-8 max-w-md text-center">
                <h1 className="text-2xl font-bold mb-3">Add Gravilo to your server to get started</h1>
                <p className="text-gray-300 text-sm mb-5">
                  You don't have any servers connected yet. Add Gravilo to a Discord server where you're the owner,
                  then come back here to configure it.
                </p>
                <a
                  href="https://discord.com/api/oauth2/authorize?client_id=1442892578264715385&permissions=534723947584&scope=bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#5865F2] hover:bg-[#6b74ff] shadow-[0_0_18px_rgba(88,101,242,0.7)] text-sm"
                >
                  Add to Discord
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="relative min-h-screen overflow-hidden">
        {/* Subtle grid / space background */}
        <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_rgba(88,101,242,0.3),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,255,182,0.2),_transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 bg-[linear-gradient(to_right,_rgba(255,255,255,0.08)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.08)_1px,_transparent_1px)] bg-[size:80px_80px]" />

        <div className="relative z-10 flex flex-col min-h-screen px-6 py-6 md:px-10 md:py-8 space-y-6">
          {/* Top Header */}
          <header className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-4 md:px-6 py-3 flex items-center justify-between shadow-[0_0_30px_rgba(0,0,0,0.6)]">
            {/* Left: Brand */}
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#5865F2] to-[#3BFFB6] flex items-center justify-center text-sm font-bold">
                G
              </div>
              <span className="font-semibold tracking-wide">Gravilo Dashboard</span>
            </div>

            {/* Center: server + context */}
            <div className="hidden md:flex items-center gap-4">
              <select 
                className="bg-white/5 border border-white/20 rounded-xl px-3 py-1.5 text-sm text-gray-200"
                value={selectedServerId || ""}
                onChange={(e) => setSelectedServerId(e.target.value)}
              >
                {servers.length === 0 && (
                  <option value="">No servers connected</option>
                )}
                {servers.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.name || "Unnamed server"} {srv.active ? "" : "(Bot removed)"}
                  </option>
                ))}
              </select>
              <select className="bg-white/5 border border-white/20 rounded-xl px-3 py-1.5 text-sm text-gray-200">
                <option>All Contexts</option>
                <option>Dev</option>
                <option>Support</option>
              </select>
            </div>

            {/* Right: Plan badge + admin + sync + logout */}
            <div className="flex items-center gap-3">
              {serverPlan === "premium" ? (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#5865F2] to-[#9B5FFF] px-3 py-1 text-xs font-semibold shadow-[0_0_20px_rgba(88,101,242,0.8)]">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Premium
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold border border-white/20 text-gray-200">
                  Free Tier
                </span>
              )}

              {isAdmin && (
                <a
                  href="/admin"
                  className="text-xs px-3 py-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition flex items-center gap-1.5 text-red-300"
                  title="Admin Panel"
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Admin</span>
                </a>
              )}

              <button
                onClick={handleSyncServer}
                disabled={syncing || !selectedServerId}
                className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/20 transition flex items-center gap-1.5 disabled:opacity-50"
                title="Sync Server Info"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Sync</span>
              </button>

              {selectedServerId && (
                <>
                  <a
                    href={`/knowledge-base?server_id=${selectedServerId}`}
                    className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/20 transition flex items-center gap-1.5"
                    title="Knowledge Base"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">KB</span>
                  </a>
                  <a
                    href={`/settings?server_id=${selectedServerId}&name=${encodeURIComponent(servers.find(s => s.id === selectedServerId)?.name || 'Server')}`}
                    className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/20 transition flex items-center gap-1.5"
                    title="Server Settings"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Settings</span>
                  </a>
                </>
              )}

              <button
                onClick={handleLogout}
                className="text-xs sm:text-sm px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition"
              >
                Logout
              </button>
            </div>
          </header>

          {/* Success Banner */}
          {showSuccessBanner && (
            <div className="bg-[#3BFFB6]/20 border border-[#3BFFB6]/40 text-[#3BFFB6] px-4 py-3 rounded-xl text-sm flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
              <span className="font-semibold">🎉 Your plan has been upgraded to Premium!</span>
              <button 
                onClick={() => setShowSuccessBanner(false)}
                className="text-[#3BFFB6] hover:text-white transition"
              >
                ✕
              </button>
            </div>
          )}

          {/* Server Header */}
          {serverOverview && (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
              {serverOverview.server.icon_url ? (
                <img 
                  src={serverOverview.server.icon_url} 
                  alt={serverOverview.server.name}
                  className="h-12 w-12 rounded-full border-2 border-white/20"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-[#5865F2] to-[#A855F7] flex items-center justify-center text-lg font-bold">
                  {serverOverview.server.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold">{serverOverview.server.name}</h1>
                  {serverOverview.server.active ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/20 px-2 py-0.5 text-xs text-gray-400 border border-gray-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                      Bot removed
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">Bot: {serverOverview.server.bot_nickname}</p>
              </div>
              {!serverOverview.server.active && (
                <a
                  href="https://discord.com/api/oauth2/authorize?client_id=1442892578264715385&permissions=534723947584&scope=bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-full bg-[#5865F2] hover:bg-[#6b74ff] transition flex items-center gap-1.5"
                >
                  Reinvite Bot
                </a>
              )}
            </div>
          )}

          {/* Loading overlay for overview */}
          {loadingOverview && (
            <div className="text-center py-8">
              <div className="h-8 w-8 rounded-full border-2 border-[#5865F2] border-t-transparent animate-spin mx-auto mb-2"></div>
              <p className="text-gray-400 text-sm">Loading server data...</p>
            </div>
          )}

          {/* Main Content */}
          {!loadingOverview && (
            <main className="flex-1 space-y-6">
              {/* Row 1: Overview */}
              <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
                {/* Overview card */}
                <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6 md:p-7 shadow-[0_0_40px_rgba(0,0,0,0.75)] relative overflow-hidden">
                  {/* Subtle inner glow */}
                  <div className="pointer-events-none absolute inset-x-10 -top-16 h-32 bg-gradient-to-r from-[#5865F2]/40 via-[#3BFFB6]/30 to-[#A855F7]/40 blur-3xl opacity-70" />

                  <div className="relative z-10 flex flex-col lg:flex-row gap-8">
                    {/* Circular usage */}
                    <div className="flex-1 flex items-center justify-center">
                      <div className="relative h-40 w-40">
                        {/* Background ring */}
                        <svg className="h-40 w-40 transform -rotate-90">
                          <circle
                            cx="80"
                            cy="80"
                            r="72"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="12"
                            fill="none"
                          />
                          <circle
                            cx="80"
                            cy="80"
                            r="72"
                            stroke="url(#usageGradient)"
                            strokeWidth="12"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={`${(usagePercent / 100) * 452} 452`}
                          />
                          <defs>
                            <linearGradient id="usageGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#5865F2" />
                              <stop offset="100%" stopColor="#A855F7" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                            Current Usage
                          </span>
                          <span className="text-2xl font-semibold">
                            {usage.toLocaleString()} / {limit.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-400 mt-1">Resets {cycleEndFormatted}</span>
                        </div>
                      </div>
                    </div>

                    {/* Recent activity list */}
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
                      <div className="space-y-2 text-xs md:text-sm">
                        <div className="flex items-center justify-center bg-white/5 rounded-xl px-3 py-6 border border-white/10 text-gray-400">
                          No recent activity yet.
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2">
                        Activity will appear here once Gravilo starts answering questions in your server.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Side stats card */}
                <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-5 shadow-[0_0_35px_rgba(0,0,0,0.7)] flex flex-col gap-4">
                  {/* Plan card */}
                  <div className="bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Server Plan</p>
                    {serverPlan === "premium" ? (
                      <>
                        <p className="text-lg font-semibold text-[#A855F7]">Premium</p>
                        <button
                          onClick={handleUpgrade}
                          className="mt-2 w-full text-xs px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/20 transition"
                        >
                          Manage Subscription
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold text-gray-300">Free Tier</p>
                        <button
                          onClick={handleUpgrade}
                          className="mt-2 w-full text-xs px-3 py-2 rounded-full bg-[#5865F2] hover:bg-[#6b74ff] shadow-[0_0_18px_rgba(88,101,242,0.7)] transition"
                        >
                          Upgrade to Premium
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex justify-between items-center bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                    <div>
                      <p className="text-xs text-gray-400">Active Channels</p>
                      <p className="text-lg font-semibold">—</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                    <div>
                      <p className="text-xs text-gray-400">Knowledge Base</p>
                      <p className="text-lg font-semibold">0 files</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                    <div>
                      <p className="text-xs text-gray-400">Bot Nickname</p>
                      <p className="text-lg font-semibold">{serverOverview?.server.bot_nickname || 'Gravilo'}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Row 2: Personality + Knowledge */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Personality Studio */}
                <div className="relative backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6 md:p-7 shadow-[0_0_40px_rgba(0,0,0,0.75)]">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Personality Studio</h2>
                    <span className="text-xs rounded-full bg-[#2b184b] px-3 py-1 border border-[#A855F7]/50 text-[#E9D5FF]">
                      Premium
                    </span>
                  </div>

                  {serverPlan === "premium" ? (
                    <>
                      {/* Preset grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                        {[
                          { label: "Helpful Assistant", desc: "Friendly & helpful tone" },
                          { label: "Sarcastic Droid", desc: "Dry humor & sarcasm" },
                          { label: "Wise Wizard", desc: "Calm & wise answers" },
                          { label: "Gen Z Gamer", desc: "Hype, slang, and memes" }
                        ].map((preset, idx) => (
                          <button
                            key={preset.label}
                            className={`rounded-2xl px-3 py-3 text-xs text-left bg-white/5 border ${
                              idx === 3 ? "border-[#3BFFB6]/60 shadow-[0_0_20px_rgba(59,255,182,0.5)]" : "border-white/10"
                            } hover:bg-white/10 transition`}
                          >
                            <div className="mb-1 font-semibold">{preset.label}</div>
                            <div className="text-[10px] text-gray-400">{preset.desc}</div>
                          </button>
                        ))}
                      </div>

                      {/* Custom prompt */}
                      <div className="space-y-2">
                        <label className="text-xs text-gray-300">Custom Personality Prompt</label>
                        <textarea
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          className="w-full h-28 bg-black/30 border border-white/15 rounded-2xl px-3 py-3 text-xs text-gray-100 resize-none outline-none focus:border-[#A855F7] focus:ring-1 focus:ring-[#A855F7]"
                          placeholder="You are Gravilo, a nerdy developer buddy for the Antigravity community. Use slang and gaming references."
                        />
                      </div>

                      {/* Behavior & Safety Section */}
                      <div className="mt-5 pt-5 border-t border-white/10">
                        <h3 className="text-sm font-semibold mb-4 text-gray-200">Behavior & Safety</h3>
                        
                        {/* Mode selector */}
                        <div className="mb-4">
                          <p className="text-xs font-medium text-gray-300 mb-2">Behavior mode</p>
                          <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-1 text-xs">
                            {[
                              { key: "quiet", label: "Quiet" },
                              { key: "normal", label: "Normal" },
                              { key: "active", label: "Active" },
                            ].map((mode) => (
                              <button
                                key={mode.key}
                                type="button"
                                onClick={() => setBehaviorMode(mode.key as "quiet" | "normal" | "active")}
                                className={`px-3 py-1 rounded-full transition ${
                                  behaviorMode === mode.key
                                    ? "bg-[#5865F2] text-white shadow-[0_0_16px_rgba(88,101,242,0.7)]"
                                    : "text-gray-300 hover:bg-white/5"
                                }`}
                              >
                                {mode.label}
                              </button>
                            ))}
                          </div>
                          <p className="mt-1 text-[11px] text-gray-400">
                            Quiet: only when pinged · Normal: when pinged + sometimes joins · Active: jumps in more often.
                          </p>
                        </div>

                        {/* Toggles */}
                        <div className="space-y-3 text-xs text-gray-200">
                          <label className="flex items-center justify-between gap-4">
                            <span>Use Knowledge Base (docs)</span>
                            <button
                              type="button"
                              onClick={() => setUseKnowledgeBase((v) => !v)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full border border-white/15 transition ${
                                useKnowledgeBase ? "bg-[#22c55e]" : "bg-black/40"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                  useKnowledgeBase ? "translate-x-4" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          </label>

                          <label className="flex items-center justify-between gap-4">
                            <span>Allow proactive replies</span>
                            <button
                              type="button"
                              onClick={() => setAllowProactiveReplies((v) => !v)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full border border-white/15 transition ${
                                allowProactiveReplies ? "bg-[#facc15]" : "bg-black/40"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                  allowProactiveReplies ? "translate-x-4" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          </label>

                          <label className="flex items-center justify-between gap-4">
                            <span>Allow fun / playful replies</span>
                            <button
                              type="button"
                              onClick={() => setAllowFunReplies((v) => !v)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full border border-white/15 transition ${
                                allowFunReplies ? "bg-[#a855f7]" : "bg-black/40"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                  allowFunReplies ? "translate-x-4" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 mt-5">
                        <button className="text-xs px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/20">
                          Reset to Default
                        </button>
                        <button 
                          onClick={handleSaveSettings}
                          disabled={savingPrompt || !selectedServerId}
                          className="text-xs px-5 py-2 rounded-full bg-[#5865F2] hover:bg-[#6b74ff] disabled:opacity-50 shadow-[0_0_18px_rgba(88,101,242,0.7)] transition"
                        >
                          {savingPrompt ? "Saving..." : "Save settings"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="relative">
                      <div className="opacity-40 pointer-events-none">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                          {[
                            { label: "Helpful Assistant", desc: "Friendly & helpful tone" },
                            { label: "Sarcastic Droid", desc: "Dry humor & sarcasm" },
                            { label: "Wise Wizard", desc: "Calm & wise answers" },
                            { label: "Gen Z Gamer", desc: "Hype, slang, and memes" }
                          ].map((preset) => (
                            <div
                              key={preset.label}
                              className="rounded-2xl px-3 py-3 text-xs text-left bg-white/5 border border-white/10"
                            >
                              <div className="mb-1 font-semibold">{preset.label}</div>
                              <div className="text-[10px] text-gray-400">{preset.desc}</div>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-gray-300">Custom Personality Prompt</label>
                          <textarea
                            className="w-full h-28 bg-black/30 border border-white/15 rounded-2xl px-3 py-3 text-xs text-gray-100 resize-none"
                            disabled
                          />
                        </div>
                      </div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 backdrop-blur-sm bg-black/20 rounded-3xl">
                        <p className="text-sm text-gray-200 mb-3">
                          Unlock custom personalities and advanced presets with the Premium plan.
                        </p>
                        <button
                          onClick={handleUpgrade}
                          className="px-6 py-3 rounded-full bg-[#5865F2] hover:bg-[#6b74ff] shadow-[0_0_20px_rgba(88,101,242,0.7)] text-xs font-semibold"
                        >
                          Upgrade to Premium
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Knowledge Base */}
                <div className="relative backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6 md:p-7 shadow-[0_0_40px_rgba(0,0,0,0.75)]">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Knowledge Base</h2>
                    <span className="text-xs rounded-full bg-[#2b184b] px-3 py-1 border border-[#A855F7]/50 text-[#E9D5FF]">
                      Premium
                    </span>
                  </div>

                  {serverPlan === "premium" ? (
                    <>
                      <button className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#3BFFB6]/10 border border-[#3BFFB6]/60 text-xs text-emerald-200 hover:bg-[#3BFFB6]/20 transition mb-4">
                        Upload File
                      </button>
                      <p className="text-[11px] text-gray-400 mb-4">PDF, TXT, Markdown, or HTML. Max 5MB.</p>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-center bg-black/30 border border-white/10 rounded-2xl px-3 py-6 text-gray-400">
                          No files uploaded yet.
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="relative">
                      <div className="opacity-40 pointer-events-none">
                        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#3BFFB6]/10 border border-[#3BFFB6]/60 text-xs text-emerald-200 mb-4">
                          Upload File
                        </button>
                        <p className="text-[11px] text-gray-400 mb-4">PDF, TXT, Markdown, or HTML. Max 5MB.</p>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between bg-black/30 border border-white/10 rounded-2xl px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-red-500/20 text-[10px]">PDF</span>
                              <span>Example_Doc.pdf</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 backdrop-blur-sm bg-black/20 rounded-3xl">
                        <p className="text-sm text-gray-200 mb-3">
                          Upload custom knowledge files and documentation with the Premium plan.
                        </p>
                        <button
                          onClick={handleUpgrade}
                          className="px-6 py-3 rounded-full bg-[#5865F2] hover:bg-[#6b74ff] shadow-[0_0_20px_rgba(88,101,242,0.7)] text-xs font-semibold"
                        >
                          Upgrade to Premium
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </main>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
