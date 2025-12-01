import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/";
      }
    };

    checkSession();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

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
              <select className="bg-white/5 border border-white/20 rounded-xl px-3 py-1.5 text-sm text-gray-200">
                <option>Antigravity Server</option>
                <option>Another Server</option>
              </select>
              <select className="bg-white/5 border border-white/20 rounded-xl px-3 py-1.5 text-sm text-gray-200">
                <option>Dev Community</option>
                <option>Main Community</option>
              </select>
            </div>

            {/* Right: Premium + user + logout */}
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#5865F2] to-[#9B5FFF] px-3 py-1 text-xs font-semibold shadow-[0_0_20px_rgba(88,101,242,0.8)]">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Premium
              </span>

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
                        <span className="text-2xl font-semibold">1,240 / 3,000</span>
                        <span className="text-xs text-gray-400 mt-1">Resets in 27 days</span>
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
                    <p className="text-xs text-gray-400">Personality Preset</p>
                    <p className="text-lg font-semibold">Gen Z Gamer</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Row 2: Personality + Knowledge */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Personality Studio */}
              <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6 md:p-7 shadow-[0_0_40px_rgba(0,0,0,0.75)]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Personality Studio</h2>
                  <span className="text-xs rounded-full bg-[#2b184b] px-3 py-1 border border-[#A855F7]/50 text-[#E9D5FF]">
                    Premium
                  </span>
                </div>

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
              </div>

              {/* Knowledge Base */}
              <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6 md:p-7 shadow-[0_0_40px_rgba(0,0,0,0.75)]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Knowledge Base</h2>
                  <span className="text-xs rounded-full bg-[#2b184b] px-3 py-1 border border-[#A855F7]/50 text-[#E9D5FF]">
                    Premium
                  </span>
                </div>

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
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
