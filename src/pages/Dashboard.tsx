import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Server = {
  id: string;
  name: string;
  icon_url: string | null;
  message_usage_current_cycle: number;
  message_limit: number;
  bot_nickname: string;
  cycle_start: string;
  cycle_end: string;
};

const Dashboard = () => {
  const [session, setSession] = useState<any>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<"free" | "premium" | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  useEffect(() => {
    // Check for upgrade success in URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgrade") === "success") {
      setShowSuccessBanner(true);
      // Clear URL params after showing banner
      window.history.replaceState({}, "", "/dashboard");
      
      // Auto-hide banner after 5 seconds
      setTimeout(() => setShowSuccessBanner(false), 5000);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      // Automatically bypass auth check in development/preview mode
      if (import.meta.env.DEV) {
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

      // Fetch or create user row
      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("id, plan")
        .eq("id", session.user.id)
        .maybeSingle();

      if (userError) {
        console.error("Error loading user row", userError);
      }

      if (!userRow) {
        // Auto-create user row if missing
        const { data: newUser, error: newUserError } = await supabase
          .from("users")
          .insert({
            id: session.user.id,
            email: session.user.email,
            plan: "free",
          })
          .select("id, plan")
          .single();

        if (newUserError) {
          console.error("Error creating user row", newUserError);
        } else {
          setUserPlan(newUser?.plan as "free" | "premium");
        }
      } else {
        setUserPlan(userRow.plan as "free" | "premium");
      }

      // Fetch servers owned by this user
      const { data: serversData, error: serversError } = await supabase
        .from("servers")
        .select("id, name, icon_url, discord_guild_id, bot_nickname, message_usage_current_cycle, message_limit, cycle_start, cycle_end, active")
        .eq("owner_id", session.user.id)
        .order("name", { ascending: true });

      if (serversError) {
        console.error("Error loading servers", serversError);
      } else {
        setServers(serversData || []);
        if (serversData && serversData.length > 0) {
          setSelectedServerId(serversData[0].id);
        }
      }

      setLoading(false);
    };

    init();
  }, []);

  const handleUpgrade = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.href = "/";
        return;
      }

      // Call create-checkout edge function
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) {
        console.error("Error creating checkout:", error);
        alert("Failed to create checkout session. Please try again.");
        return;
      }

      if (data?.url) {
        // Open checkout in new tab
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

  const selectedServer = servers.find((s) => s.id === selectedServerId);
  const usage = selectedServer?.message_usage_current_cycle ?? 0;
  const limit = selectedServer?.message_limit ?? 3000;
  const cycleEnd = selectedServer?.cycle_end ? new Date(selectedServer.cycle_end) : null;
  const cycleEndFormatted = cycleEnd ? cycleEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

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
                <h1 className="text-2xl font-bold mb-3">No servers connected</h1>
                <p className="text-gray-300 text-sm mb-5">
                  Add Gravilo to a Discord server using the "Add to Discord" button on the homepage,
                  then come back here to configure it.
                </p>
                <a
                  href="/"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#5865F2] hover:bg-[#6b74ff] shadow-[0_0_18px_rgba(88,101,242,0.7)] text-sm"
                >
                  Go to Homepage
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
                    {srv.name || "Unnamed server"}
                  </option>
                ))}
              </select>
              <select className="bg-white/5 border border-white/20 rounded-xl px-3 py-1.5 text-sm text-gray-200">
                <option>All Contexts</option>
                <option>Dev</option>
                <option>Support</option>
              </select>
            </div>

            {/* Right: Premium + user + logout */}
            <div className="flex items-center gap-3">
              {userPlan === "premium" && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#5865F2] to-[#9B5FFF] px-3 py-1 text-xs font-semibold shadow-[0_0_20px_rgba(88,101,242,0.8)]">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Premium
                </span>
              )}

              {userPlan === "free" && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold border border-white/20 text-gray-200">
                  Free plan
                </span>
              )}

              <div className="hidden sm:flex items-center gap-2 bg-white/5 rounded-full px-3 py-1 border border-white/10">
                <div className="h-7 w-7 rounded-full bg-[#222741] flex items-center justify-center text-xs font-semibold">
                  JD
                </div>
                <span className="text-xs text-gray-200">John_Doe</span>
              </div>

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

          {/* Main Content */}
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
                    <div className="relative h-40 w-40 rounded-full bg-gradient-to-tr from-[#5865F2] to-[#A855F7] p-[3px]">
                      <div className="h-full w-full rounded-full bg-[#050814] flex flex-col items-center justify-center">
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
                      <div className="flex justify-between bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                        <span>How do I install Antigravity?</span>
                        <span className="text-[#8B9DFF]">#help</span>
                      </div>
                      <div className="flex justify-between bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                        <span>Can Gravilo explain Docker volumes?</span>
                        <span className="text-[#8B9DFF]">#dev-chat</span>
                      </div>
                      <div className="flex justify-between bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                        <span>What does error EADDRINUSE mean?</span>
                        <span className="text-[#8B9DFF]">#general</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Side stats card */}
              <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-5 shadow-[0_0_35px_rgba(0,0,0,0.7)] flex flex-col gap-4">
                <div className="flex justify-between items-center bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                  <div>
                    <p className="text-xs text-gray-400">Active Channels This Week</p>
                    <p className="text-lg font-semibold">24 channels</p>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                  <div>
                    <p className="text-xs text-gray-400">Knowledge Base</p>
                    <p className="text-lg font-semibold">5 files</p>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                  <div>
                    <p className="text-xs text-gray-400">Bot Nickname</p>
                    <p className="text-lg font-semibold">{selectedServer?.bot_nickname || 'Gravilo'}</p>
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

                {userPlan === "premium" ? (
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
                        className="w-full h-28 bg-black/30 border border-white/15 rounded-2xl px-3 py-3 text-xs text-gray-100 resize-none"
                        placeholder="You are Gravilo, a nerdy developer buddy for the Antigravity community. Use slang and gaming references."
                      />
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                      <button className="text-xs px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/20">
                        Reset to Default
                      </button>
                      <button className="text-xs px-5 py-2 rounded-full bg-[#5865F2] hover:bg-[#6b74ff] shadow-[0_0_18px_rgba(88,101,242,0.7)]">
                        Save
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

                {userPlan === "premium" ? (
                  <>
                    <button className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#3BFFB6]/10 border border-[#3BFFB6]/60 text-xs text-emerald-200 hover:bg-[#3BFFB6]/20 transition mb-4">
                      Upload File
                    </button>
                    <p className="text-[11px] text-gray-400 mb-4">PDF, TXT, Markdown, or HTML. Max 5MB.</p>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between bg-black/30 border border-white/10 rounded-2xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-red-500/20 text-[10px]">PDF</span>
                          <span>Antigravity_Docs.pdf</span>
                        </div>
                        <span className="text-amber-300">Indexing…</span>
                      </div>

                      <div className="flex items-center justify-between bg-black/30 border border-white/10 rounded-2xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-sky-500/20 text-[10px]">MD</span>
                          <span>Docker_Guide.md</span>
                        </div>
                        <span className="text-emerald-300">Ready</span>
                      </div>

                      <div className="flex items-center justify-between bg-black/30 border border-white/10 rounded-2xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-lime-500/20 text-[10px]">TXT</span>
                          <span>Server_Rules.txt</span>
                        </div>
                        <span className="text-emerald-300">Ready</span>
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
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
