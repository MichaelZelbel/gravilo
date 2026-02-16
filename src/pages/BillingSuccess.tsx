import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import SEOHead from "@/components/seo/SEOHead";

const BillingSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const serverId = searchParams.get("server_id");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate(`/dashboard?upgrade=success`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <SEOHead title="Billing Success - Gravilo" noIndex />
      <div className="relative min-h-screen overflow-hidden">
        {/* Background effects */}
        <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_rgba(88,101,242,0.3),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,255,182,0.2),_transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 bg-[linear-gradient(to_right,_rgba(255,255,255,0.08)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.08)_1px,_transparent_1px)] bg-[size:80px_80px]" />

        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
          <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-10 max-w-md text-center shadow-[0_0_60px_rgba(88,101,242,0.4)]">
            {/* Success icon */}
            <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-[#22c55e] to-[#3BFFB6] flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(59,255,182,0.6)]">
              <svg
                className="h-10 w-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-[#5865F2] via-[#A855F7] to-[#3BFFB6] bg-clip-text text-transparent">
              Premium Activated!
            </h1>

            <p className="text-gray-300 mb-6">
              Your server has been upgraded to the <span className="text-[#A855F7] font-semibold">Premium plan</span>. 
              Enjoy custom personalities, extended message limits, and all premium features.
            </p>

            <div className="space-y-4">
              <button
                onClick={() => navigate("/dashboard?upgrade=success")}
                className="w-full px-6 py-3 rounded-full bg-[#5865F2] hover:bg-[#6b74ff] shadow-[0_0_20px_rgba(88,101,242,0.7)] text-sm font-semibold transition"
              >
                Go to Dashboard
              </button>

              <p className="text-xs text-gray-500">
                Redirecting in {countdown} seconds...
              </p>
            </div>
          </div>

          {/* Premium features preview */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            {[
              { icon: "🎭", title: "Custom Personality", desc: "Create unique bot personas" },
              { icon: "📚", title: "Knowledge Base", desc: "Upload docs & PDFs" },
              { icon: "📊", title: "10,000 Messages", desc: "Extended monthly limit" },
            ].map((feature) => (
              <div
                key={feature.title}
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center"
              >
                <div className="text-2xl mb-1">{feature.icon}</div>
                <p className="text-xs font-semibold text-gray-200">{feature.title}</p>
                <p className="text-[10px] text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingSuccess;
