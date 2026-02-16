import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import SEOHead from "@/components/seo/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ServerSettingsData = {
  personality_preset: string;
  custom_personality_prompt: string | null;
  enable_moderation: boolean;
  enable_kb_ingestion: boolean;
  model_name: string;
  max_reply_tokens: number;
  behavior_mode: string;
  allow_fun_replies: boolean;
  allow_proactive_replies: boolean;
};

const PERSONALITY_PRESETS = [
  { value: "helpful", label: "Helpful Assistant", description: "Friendly, clear, and professional" },
  { value: "sarcastic", label: "Sarcastic Droid", description: "Witty with dry humor" },
  { value: "wizard", label: "Wise Wizard", description: "Mystical and thoughtful" },
  { value: "genz", label: "Gen Z Gamer", description: "Casual, trendy slang" },
  { value: "custom", label: "Custom", description: "Write your own personality" },
];

const MODEL_OPTIONS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini", description: "Fast & efficient" },
  { value: "gpt-4o", label: "GPT-4o", description: "More capable" },
  { value: "claude-haiku", label: "Claude Haiku", description: "Fast & light" },
  { value: "claude-sonnet", label: "Claude Sonnet", description: "Balanced" },
];

const ServerSettings = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const serverId = searchParams.get("server_id");
  const serverName = searchParams.get("name") || "Server";
  
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ServerSettingsData>({
    personality_preset: "helpful",
    custom_personality_prompt: null,
    enable_moderation: false,
    enable_kb_ingestion: true,
    model_name: "gpt-4o-mini",
    max_reply_tokens: 500,
    behavior_mode: "quiet",
    allow_fun_replies: true,
    allow_proactive_replies: false,
  });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/");
        return;
      }
      
      setSession(session);
      
      if (!serverId) {
        navigate("/dashboard");
        return;
      }

      // Load existing settings
      const { data: settingsData, error } = await supabase
        .from("server_settings")
        .select("*")
        .eq("server_id", serverId)
        .maybeSingle();

      if (error) {
        console.error("Error loading settings:", error);
      }

      if (settingsData) {
        setSettings({
          personality_preset: settingsData.personality_preset || "helpful",
          custom_personality_prompt: settingsData.custom_personality_prompt,
          enable_moderation: settingsData.enable_moderation ?? false,
          enable_kb_ingestion: settingsData.enable_kb_ingestion ?? settingsData.use_knowledge_base ?? true,
          model_name: settingsData.model_name || "gpt-4o-mini",
          max_reply_tokens: settingsData.max_reply_tokens ?? 500,
          behavior_mode: settingsData.behavior_mode || "quiet",
          allow_fun_replies: settingsData.allow_fun_replies ?? true,
          allow_proactive_replies: settingsData.allow_proactive_replies ?? false,
        });
      }

      setLoading(false);
    };

    init();
  }, [serverId, navigate]);

  const handleSave = async () => {
    if (!serverId || !session) return;
    
    setSaving(true);

    try {
      // Get the discord_guild_id for this server
      const { data: serverData } = await supabase
        .from("servers")
        .select("discord_guild_id")
        .eq("id", serverId)
        .single();

      const { error } = await supabase
        .from("server_settings")
        .upsert({
          server_id: serverId,
          user_id: session.user.id,
          discord_server_id: serverData?.discord_guild_id || null,
          personality_preset: settings.personality_preset,
          custom_personality_prompt: settings.personality_preset === "custom" ? settings.custom_personality_prompt : null,
          enable_moderation: settings.enable_moderation,
          enable_kb_ingestion: settings.enable_kb_ingestion,
          use_knowledge_base: settings.enable_kb_ingestion, // Keep in sync
          model_name: settings.model_name,
          max_reply_tokens: settings.max_reply_tokens,
          behavior_mode: settings.behavior_mode,
          allow_fun_replies: settings.allow_fun_replies,
          allow_proactive_replies: settings.allow_proactive_replies,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "server_id",
        });

      if (error) {
        console.error("Error saving settings:", error);
        toast({
          title: "Error",
          description: "Failed to save settings. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Settings saved",
          description: "Your server settings have been updated.",
        });
      }
    } catch (err) {
      console.error("Save error:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050814] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full border-4 border-[#5865F2] border-t-transparent animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <SEOHead title="Server Settings - Gravilo" noIndex />
      <div className="relative min-h-screen overflow-hidden">
        {/* Background effects */}
        <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_rgba(88,101,242,0.3),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,255,182,0.2),_transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 bg-[linear-gradient(to_right,_rgba(255,255,255,0.08)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.08)_1px,_transparent_1px)] bg-[size:80px_80px]" />

        <div className="relative z-10 flex flex-col min-h-screen px-6 py-6 md:px-10 md:py-8 space-y-6">
          {/* Header */}
          <header className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-4 md:px-6 py-3 flex items-center justify-between shadow-[0_0_30px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/dashboard")}
                className="p-2 rounded-lg hover:bg-white/10 transition"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="font-semibold">Server Settings</h1>
                <p className="text-xs text-gray-400">{serverName}</p>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5865F2] hover:bg-[#6b74ff] disabled:opacity-50 transition text-sm font-medium"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Settings
            </button>
          </header>

          {/* Main Content */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Personality Section */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">Personality</h2>
              
              <div className="space-y-3">
                <label className="text-sm text-gray-400">Preset</label>
                <div className="grid grid-cols-1 gap-2">
                  {PERSONALITY_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setSettings(s => ({ ...s, personality_preset: preset.value }))}
                      className={`text-left p-3 rounded-xl border transition ${
                        settings.personality_preset === preset.value
                          ? "bg-[#5865F2]/20 border-[#5865F2]"
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      }`}
                    >
                      <span className="font-medium">{preset.label}</span>
                      <span className="text-xs text-gray-400 ml-2">{preset.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {settings.personality_preset === "custom" && (
                <div className="mt-4 space-y-2">
                  <label className="text-sm text-gray-400">Custom Prompt</label>
                  <textarea
                    value={settings.custom_personality_prompt || ""}
                    onChange={(e) => setSettings(s => ({ ...s, custom_personality_prompt: e.target.value }))}
                    placeholder="Describe how Gravilo should behave..."
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-[#5865F2]"
                  />
                </div>
              )}
            </div>

            {/* Features Section */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">Features</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div>
                    <p className="font-medium">Enable Moderation</p>
                    <p className="text-xs text-gray-400">Auto-moderate inappropriate content</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, enable_moderation: !s.enable_moderation }))}
                    className={`w-12 h-6 rounded-full transition ${
                      settings.enable_moderation ? "bg-[#5865F2]" : "bg-white/20"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.enable_moderation ? "translate-x-6" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div>
                    <p className="font-medium">Knowledge Base Ingestion</p>
                    <p className="text-xs text-gray-400">Learn from uploaded documents</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, enable_kb_ingestion: !s.enable_kb_ingestion }))}
                    className={`w-12 h-6 rounded-full transition ${
                      settings.enable_kb_ingestion ? "bg-[#5865F2]" : "bg-white/20"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.enable_kb_ingestion ? "translate-x-6" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div>
                    <p className="font-medium">Fun Replies</p>
                    <p className="text-xs text-gray-400">Allow playful and banter responses</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, allow_fun_replies: !s.allow_fun_replies }))}
                    className={`w-12 h-6 rounded-full transition ${
                      settings.allow_fun_replies ? "bg-[#5865F2]" : "bg-white/20"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.allow_fun_replies ? "translate-x-6" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div>
                    <p className="font-medium">Proactive Replies</p>
                    <p className="text-xs text-gray-400">Jump into conversations automatically</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, allow_proactive_replies: !s.allow_proactive_replies }))}
                    className={`w-12 h-6 rounded-full transition ${
                      settings.allow_proactive_replies ? "bg-[#5865F2]" : "bg-white/20"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.allow_proactive_replies ? "translate-x-6" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Model Section */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">AI Model</h2>
              
              <div className="space-y-3">
                <label className="text-sm text-gray-400">Model</label>
                <div className="grid grid-cols-2 gap-2">
                  {MODEL_OPTIONS.map((model) => (
                    <button
                      key={model.value}
                      onClick={() => setSettings(s => ({ ...s, model_name: model.value }))}
                      className={`text-left p-3 rounded-xl border transition ${
                        settings.model_name === model.value
                          ? "bg-[#5865F2]/20 border-[#5865F2]"
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      }`}
                    >
                      <span className="font-medium text-sm">{model.label}</span>
                      <p className="text-xs text-gray-400">{model.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Output Section */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">Output</h2>
              
              <div className="space-y-3">
                <label className="text-sm text-gray-400">Max Reply Tokens</label>
                <input
                  type="number"
                  value={settings.max_reply_tokens}
                  onChange={(e) => setSettings(s => ({ ...s, max_reply_tokens: parseInt(e.target.value) || 500 }))}
                  min={100}
                  max={4000}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-[#5865F2]"
                />
                <p className="text-xs text-gray-400">
                  Controls max response length. Higher = longer replies, more cost.
                </p>
              </div>

              <div className="mt-4 space-y-3">
                <label className="text-sm text-gray-400">Behavior Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {["quiet", "normal", "active"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSettings(s => ({ ...s, behavior_mode: mode }))}
                      className={`p-2 rounded-xl border transition text-sm capitalize ${
                        settings.behavior_mode === mode
                          ? "bg-[#5865F2]/20 border-[#5865F2]"
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  Quiet: Only responds when mentioned. Normal: Occasionally joins. Active: Proactive engagement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerSettings;
