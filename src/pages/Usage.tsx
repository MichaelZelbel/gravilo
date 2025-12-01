import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Usage = () => {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/";
      } else {
        setSession(session);
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

        <div className="relative z-10 flex flex-col min-h-screen px-6 py-6 md:px-10 md:py-8">
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
          <div className="flex-1 mt-6 md:mt-8 space-y-8 max-w-5xl mx-auto px-4 md:px-0 w-full">
            {/* Your Plan Card */}
            <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 shadow-[0_0_40px_rgba(0,0,0,0.7)]">
              <h1 className="text-2xl font-bold mb-4">Your Plan</h1>

              <div className="flex flex-col md:flex-row justify-between md:items-center">
                <div>
                  <p className="text-gray-300 text-sm">Current Plan</p>
                  <p className="text-xl font-semibold mt-1">Premium Plan</p>
                </div>

                <button className="mt-4 md:mt-0 bg-[#5865F2] hover:bg-[#6b74ff] px-6 py-3 rounded-full shadow-[0_0_20px_rgba(88,101,242,0.6)] transition">
                  Manage Subscription
                </button>
              </div>
            </div>

            {/* Usage Overview Card */}
            <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 shadow-[0_0_40px_rgba(0,0,0,0.7)]">
              <h2 className="text-xl font-semibold mb-4">Message Usage</h2>

              <div className="flex flex-col md:flex-row gap-10 items-center md:items-start">
                {/* Circular usage */}
                <div className="relative h-40 w-40 rounded-full bg-gradient-to-tr from-[#5865F2] to-[#A855F7] p-[3px]">
                  <div className="h-full w-full rounded-full bg-[#050814] flex flex-col items-center justify-center">
                    <span className="text-xs uppercase tracking-wide text-gray-400 mb-1">Used</span>
                    <span className="text-2xl font-bold">1,240 / 3,000</span>
                    <span className="text-xs text-gray-400 mt-2">Resets in 27 days</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                    <span className="text-gray-300">This Month's Messages</span>
                    <span className="font-semibold">1,240</span>
                  </div>

                  <div className="flex justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                    <span className="text-gray-300">Plan Limit</span>
                    <span className="font-semibold">3,000</span>
                  </div>

                  <div className="flex justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                    <span className="text-gray-300">Estimated Cost</span>
                    <span className="font-semibold">$4.50</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Upgrade to Premium CTA */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-[0_0_25px_rgba(88,101,242,0.5)]">
              <h2 className="text-xl font-semibold mb-3">Upgrade to Premium</h2>
              <p className="text-gray-300 text-sm mb-4">
                Unlock custom personality prompts, knowledge uploads, analytics, and 3,000 messages per month.
              </p>

              <button className="px-6 py-3 rounded-full bg-[#5865F2] hover:bg-[#6b74ff] shadow-[0_0_20px_rgba(88,101,242,0.7)] transition">
                Upgrade Now
              </button>
            </div>

            {/* Footer */}
            <div className="text-center text-gray-500 text-xs mt-10 pb-6">
              © 2025 Gravilo AI — All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Usage;
