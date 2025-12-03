import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Shield, Settings, FileText, Upload, Loader2, CheckCircle, AlertCircle, Clock, X, Hash, Volume2, MessageSquare, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Channel = {
  discord_channel_id: string;
  discord_channel_name: string;
  discord_channel_type: string;
  type: number;
  position: number;
  allowed: boolean;
};

type KBFile = {
  id: string;
  discord_server_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  status: string;
  num_chunks: number | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
};

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
  const navigate = useNavigate();
  const { toast } = useToast();
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
  
  // Knowledge Base state
  const [kbFiles, setKbFiles] = useState<KBFile[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbUploading, setKbUploading] = useState(false);
  const [kbAccessDenied, setKbAccessDenied] = useState(false);
  const [kbDragging, setKbDragging] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Active Channels state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsModalOpen, setChannelsModalOpen] = useState(false);
  const [updatingChannelId, setUpdatingChannelId] = useState<string | null>(null);

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

      // Fetch servers owned by this user directly via owner_id
      const { data: serversData, error: serversError } = await supabase
        .from("servers")
        .select("id, name, icon_url, discord_guild_id, bot_nickname, message_usage_current_cycle, message_limit, cycle_start, cycle_end, active")
        .eq("owner_id", session.user.id)
        .order("active", { ascending: false })
        .order("name", { ascending: true });

      if (serversError) {
        console.error("Error loading servers", serversError);
        setServers([]);
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

  // Fetch KB files for selected server
  const fetchKbFiles = useCallback(async () => {
    if (!serverOverview?.server?.discord_guild_id || !session) return;
    
    setKbLoading(true);
    setKbAccessDenied(false);
    
    try {
      const url = `https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/kb-list?server_id=${serverOverview.server.discord_guild_id}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.status === 403) {
        setKbAccessDenied(true);
        setKbFiles([]);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setKbFiles(data.files || []);
      } else {
        console.error("Failed to fetch KB files");
        setKbFiles([]);
      }
    } catch (err) {
      console.error("Error fetching KB files:", err);
      setKbFiles([]);
    } finally {
      setKbLoading(false);
    }
  }, [serverOverview?.server?.discord_guild_id, session]);

  // Load KB files when server overview changes
  useEffect(() => {
    fetchKbFiles();
  }, [fetchKbFiles]);

  // Polling for KB file status updates (every 5 seconds)
  useEffect(() => {
    const hasProcessingFiles = kbFiles.some(f => f.status === "pending" || f.status === "uploaded" || f.status === "indexing");
    
    if (hasProcessingFiles && serverOverview?.server?.discord_guild_id && session) {
      // Start polling every 5 seconds
      pollingRef.current = setInterval(() => {
        fetchKbFiles();
      }, 5000);
      
      // Stop after 5 minutes
      const timeout = setTimeout(() => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }, 300000);
      
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        clearTimeout(timeout);
      };
    }
  }, [kbFiles, serverOverview?.server?.discord_guild_id, session, fetchKbFiles]);

  // Fetch channels for selected server
  const fetchChannels = useCallback(async () => {
    if (!selectedServerId || !session) return;
    
    setChannelsLoading(true);
    
    try {
      const url = `https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/server-channels-list?server_id=${selectedServerId}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);
      } else {
        console.error("Failed to fetch channels");
        setChannels([]);
      }
    } catch (err) {
      console.error("Error fetching channels:", err);
      setChannels([]);
    } finally {
      setChannelsLoading(false);
    }
  }, [selectedServerId, session]);

  // Load channels when server changes
  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Update channel allowed status
  const updateChannelAllowed = async (channelId: string, allowed: boolean) => {
    if (!selectedServerId || !session) return;
    
    setUpdatingChannelId(channelId);
    
    // Optimistically update UI
    setChannels(prev => prev.map(ch => 
      ch.discord_channel_id === channelId ? { ...ch, allowed } : ch
    ));
    
    try {
      const url = `https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/server-channels-update`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          server_id: selectedServerId,
          discord_channel_id: channelId,
          allowed,
        }),
      });

      if (response.ok) {
        toast({
          title: allowed ? "Channel enabled" : "Channel disabled",
          description: `Gravilo will ${allowed ? "now respond in" : "no longer respond in"} this channel.`,
        });
      } else {
        // Revert on failure
        setChannels(prev => prev.map(ch => 
          ch.discord_channel_id === channelId ? { ...ch, allowed: !allowed } : ch
        ));
        toast({
          title: "Failed to update channel",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error updating channel:", err);
      // Revert on error
      setChannels(prev => prev.map(ch => 
        ch.discord_channel_id === channelId ? { ...ch, allowed: !allowed } : ch
      ));
      toast({
        title: "Failed to update channel",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingChannelId(null);
    }
  };

  // Handle KB file upload
  const handleKbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadKbFile(file);
  };

  // Upload KB file (used by both input and drag-drop)
  const uploadKbFile = async (file: File) => {
    if (!serverOverview?.server?.discord_guild_id || !session) return;
    
    setKbUploading(true);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("discord_server_id", serverOverview.server.discord_guild_id);
      
      const response = await fetch(
        "https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/kb-upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        toast({
          title: "Document uploaded",
          description: "Processing started…",
        });
        // Refresh file list
        await fetchKbFiles();
      } else {
        const errorData = await response.json();
        toast({
          title: "Upload failed",
          description: errorData.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("KB upload error:", err);
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setKbUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle drag and drop
  const handleKbDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setKbDragging(true);
  };

  const handleKbDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setKbDragging(false);
  };

  const handleKbDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setKbDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadKbFile(file);
    }
  };

  // Handle KB file delete
  const handleKbDelete = async (fileId: string) => {
    if (!session) return;
    
    setDeletingFileId(fileId);
    
    try {
      const response = await fetch(
        "https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/kb-delete",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ file_id: fileId }),
        }
      );

      if (response.ok) {
        toast({
          title: "File deleted",
          description: "Document removed from knowledge base.",
        });
        // Remove from local state
        setKbFiles(prev => prev.filter(f => f.id !== fileId));
      } else {
        const errorData = await response.json();
        toast({
          title: "Delete failed",
          description: errorData.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("KB delete error:", err);
      toast({
        title: "Delete failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingFileId(null);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

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
      const url = `https://sohyviltwgpuslbjzqzh.supabase.co/functions/v1/sync-server`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ server_id: selectedServerId }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log("Sync response:", data);
        
        // Update local server state with new data
        if (data.server) {
          setServers(prev => prev.map(s => 
            s.id === selectedServerId 
              ? { ...s, name: data.server.name, icon_url: data.server.icon_url }
              : s
          ));
          
          // Update server overview with new data
          setServerOverview(prev => prev ? {
            ...prev,
            server: {
              ...prev.server,
              name: data.server.name,
              icon_url: data.server.icon_url,
            }
          } : null);
        }
        
        // Refresh KB files
        fetchKbFiles();
        
        // Refresh channels
        fetchChannels();
        
        toast({
          title: "Server synced successfully",
          description: data.channels?.length 
            ? `Updated ${data.channels.length} channels` 
            : "Server metadata updated",
        });
      } else {
        console.error("Sync failed:", data);
        toast({
          title: "Sync failed",
          description: data.error || "Could not sync server. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Sync error:", err);
      toast({
        title: "Sync error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }

    setSyncing(false);
  };

  // Refresh usage data
  const [refreshingUsage, setRefreshingUsage] = useState(false);
  const refreshUsageData = async () => {
    if (!selectedServerId || !session) return;
    setRefreshingUsage(true);
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
      }
    } catch (err) {
      console.error("Error refreshing usage:", err);
    }
    setRefreshingUsage(false);
  };

  // Derived values from serverOverview
  const serverPlan = serverOverview?.plan || "free";
  const usage = serverOverview?.usage.messages_used ?? 0;
  const limit = serverOverview?.usage.messages_cap ?? 3000;
  const cycleEnd = serverOverview?.usage.cycle_end ? new Date(serverOverview.usage.cycle_end) : null;
  const cycleEndFormatted = cycleEnd ? cycleEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
  const usagePercent = limit > 0 ? Math.min((usage / limit) * 100, 100) : 0;
  const isCritical = usagePercent >= 95;
  const isWarning = usagePercent >= 80 && usagePercent < 95;
  const isAtLimit = usage >= limit;

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
                  {/* Refresh button */}
                  <button
                    onClick={refreshUsageData}
                    disabled={refreshingUsage}
                    className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition disabled:opacity-50"
                    title="Refresh usage data"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshingUsage ? "animate-spin" : ""}`} />
                  </button>
                  {/* Subtle inner glow */}
                  <div className="pointer-events-none absolute inset-x-10 -top-16 h-32 bg-gradient-to-r from-[#5865F2]/40 via-[#3BFFB6]/30 to-[#A855F7]/40 blur-3xl opacity-70" />

                  <div className="relative z-10 flex flex-col lg:flex-row gap-8">
                    {/* Circular usage */}
                    <div className="flex-1 flex flex-col items-center justify-center">
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
                            stroke={isCritical || isAtLimit ? "url(#usageGradientRed)" : isWarning ? "url(#usageGradientOrange)" : "url(#usageGradient)"}
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
                            <linearGradient id="usageGradientOrange" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#F59E0B" />
                              <stop offset="100%" stopColor="#EF4444" />
                            </linearGradient>
                            <linearGradient id="usageGradientRed" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#EF4444" />
                              <stop offset="100%" stopColor="#DC2626" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                            Current Usage
                          </span>
                          <span className={`text-2xl font-semibold ${isCritical || isAtLimit ? "text-red-400" : isWarning ? "text-orange-400" : ""}`}>
                            {usage.toLocaleString()} / {limit.toLocaleString()}
                          </span>
                          <span className={`text-sm font-medium mt-1 ${isCritical || isAtLimit ? "text-red-400" : isWarning ? "text-orange-400" : "text-gray-300"}`}>
                            {Math.round(usagePercent)}%
                          </span>
                          <span className="text-xs text-gray-400 mt-1">Resets {cycleEndFormatted}</span>
                        </div>
                      </div>
                      
                      {/* Limit reached warning */}
                      {isAtLimit && (
                        <div className="mt-4 text-center">
                          <p className="text-sm text-red-400 font-medium mb-2">
                            Limit reached – Gravilo won't reply until reset
                          </p>
                          {serverPlan !== "premium" && (
                            <button
                              onClick={handleUpgrade}
                              className="text-xs px-4 py-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-[0_0_18px_rgba(239,68,68,0.5)] transition"
                            >
                              Upgrade to increase limit
                            </button>
                          )}
                        </div>
                      )}
                      
                      {/* Near limit warning */}
                      {isWarning && !isAtLimit && serverPlan !== "premium" && (
                        <div className="mt-4 text-center">
                          <p className="text-xs text-orange-400 mb-1">
                            Running low on messages – Consider upgrading to Premium
                          </p>
                          <button
                            onClick={handleUpgrade}
                            className="text-xs px-3 py-1.5 rounded-full bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 transition"
                          >
                            Upgrade for more
                          </button>
                        </div>
                      )}
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

                  <button
                    onClick={() => setChannelsModalOpen(true)}
                    className="w-full flex justify-between items-center bg-white/5 rounded-2xl px-4 py-3 border border-white/10 hover:bg-white/10 hover:border-white/20 transition cursor-pointer text-left"
                  >
                    <div>
                      <p className="text-xs text-gray-400">Active Channels</p>
                      {channelsLoading ? (
                        <p className="text-lg font-semibold text-gray-400">Loading...</p>
                      ) : channels.length === 0 ? (
                        <p className="text-lg font-semibold text-gray-500">No channels</p>
                      ) : (
                        <p className="text-lg font-semibold text-[#3BFFB6]">
                          {channels.filter(c => c.allowed).length} active
                        </p>
                      )}
                      {channels.length === 0 && !channelsLoading && (
                        <p className="text-[10px] text-gray-500 mt-0.5">Click to sync & configure</p>
                      )}
                    </div>
                    <Settings className="h-4 w-4 text-gray-500" />
                  </button>

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
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold">Knowledge Base</h2>
                    <span className="text-xs rounded-full bg-[#2b184b] px-3 py-1 border border-[#A855F7]/50 text-[#E9D5FF]">
                      Premium
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Upload documents to improve Gravilo's answers in this Discord server.</p>

                  {serverPlan === "premium" ? (
                    <>
                      {kbAccessDenied ? (
                        <div className="flex items-center justify-center bg-black/30 border border-white/10 rounded-2xl px-3 py-6 text-gray-400 text-xs">
                          You don't have access to this server's Knowledge Base.
                        </div>
                      ) : (
                        <>
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleKbUpload}
                            accept=".pdf,.txt,.md,.html"
                            className="hidden"
                          />
                          
                          {/* Drag and drop upload area */}
                          <div
                            onDragOver={handleKbDragOver}
                            onDragLeave={handleKbDragLeave}
                            onDrop={handleKbDrop}
                            onClick={() => !kbUploading && fileInputRef.current?.click()}
                            className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-6 mb-4 text-center transition-all ${
                              kbDragging
                                ? "border-[#3BFFB6] bg-[#3BFFB6]/10"
                                : "border-white/20 hover:border-white/40 bg-black/20"
                            } ${kbUploading ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            {kbUploading ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-8 w-8 animate-spin text-[#3BFFB6]" />
                                <p className="text-sm text-gray-300">Uploading...</p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2">
                                <Upload className={`h-8 w-8 ${kbDragging ? "text-[#3BFFB6]" : "text-gray-400"}`} />
                                <p className="text-sm text-gray-300">
                                  {kbDragging ? "Drop file here" : "Drag and drop a file here"}
                                </p>
                                <button
                                  type="button"
                                  className="text-xs px-4 py-2 rounded-full bg-[#3BFFB6]/10 border border-[#3BFFB6]/60 text-emerald-200 hover:bg-[#3BFFB6]/20 transition"
                                >
                                  Select File
                                </button>
                                <p className="text-[10px] text-gray-500 mt-1">PDF, TXT, Markdown, or HTML. Max 5MB.</p>
                              </div>
                            )}
                          </div>

                          {/* File list */}
                          <div className="space-y-2 text-xs max-h-48 overflow-y-auto">
                            {kbLoading && kbFiles.length === 0 ? (
                              <div className="flex items-center justify-center bg-black/30 border border-white/10 rounded-2xl px-3 py-6 text-gray-400">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Loading files...
                              </div>
                            ) : kbFiles.length === 0 ? (
                              <div className="flex items-center justify-center bg-black/30 border border-white/10 rounded-2xl px-3 py-6 text-gray-400">
                                No files uploaded yet for this server.
                              </div>
                            ) : (
                              kbFiles.map((file) => (
                                <div key={file.id} className="flex items-center justify-between bg-black/30 border border-white/10 rounded-2xl px-3 py-2">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                    <div className="min-w-0">
                                      <div className="truncate font-medium">{file.file_name}</div>
                                      <div className="text-[10px] text-gray-500">
                                        {formatDate(file.created_at)}
                                        {file.file_size && ` · ${formatFileSize(file.file_size)}`}
                                      </div>
                                      {file.status === "error" && file.error_message && (
                                        <div className="text-[10px] text-red-400 truncate">{file.error_message}</div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    {/* Status badges */}
                                    {(file.status === "pending" || file.status === "uploaded" || file.status === "indexing") && (
                                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                        Processing
                                      </span>
                                    )}
                                    {(file.status === "ready" || file.status === "done") && (
                                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                                        <CheckCircle className="h-2.5 w-2.5" />
                                        Indexed
                                      </span>
                                    )}
                                    {file.status === "error" && (
                                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                                        <AlertCircle className="h-2.5 w-2.5" />
                                        Error
                                      </span>
                                    )}
                                    {/* Delete button */}
                                    <button
                                      onClick={() => handleKbDelete(file.id)}
                                      disabled={deletingFileId === file.id}
                                      className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition disabled:opacity-50"
                                      title="Delete file"
                                    >
                                      {deletingFileId === file.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="relative">
                      <div className="opacity-40 pointer-events-none">
                        <div className="border-2 border-dashed border-white/20 rounded-2xl p-6 mb-4 text-center">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-300">Drag and drop a file here</p>
                          <button className="text-xs px-4 py-2 mt-2 rounded-full bg-[#3BFFB6]/10 border border-[#3BFFB6]/60 text-emerald-200">
                            Select File
                          </button>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between bg-black/30 border border-white/10 rounded-2xl px-3 py-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400" />
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

      {/* Active Channels Modal */}
      <Dialog open={channelsModalOpen} onOpenChange={setChannelsModalOpen}>
        <DialogContent className="max-w-lg bg-[#0a0f1e] border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Active Channels for {serverOverview?.server.name || "Server"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Sync button */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {channels.length} channel{channels.length !== 1 ? "s" : ""} · {channels.filter(c => c.allowed).length} active
              </p>
              <button
                onClick={async () => {
                  await handleSyncServer();
                }}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 text-xs text-[#5865F2] hover:text-[#7983ff] transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                Sync from Discord
              </button>
            </div>

            {/* Channel list */}
            <div className="max-h-80 overflow-y-auto space-y-2">
              {channelsLoading && channels.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading channels...
                </div>
              ) : channels.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <p className="mb-2">No channels found.</p>
                  <p className="text-xs">Click "Sync from Discord" to fetch your server's channels.</p>
                </div>
              ) : (
                channels
                  .filter(ch => ch.discord_channel_type === "text" || ch.discord_channel_type === "announcement" || ch.discord_channel_type === "forum")
                  .map((channel) => (
                    <div
                      key={channel.discord_channel_id}
                      className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {channel.discord_channel_type === "text" && <Hash className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                        {channel.discord_channel_type === "announcement" && <MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                        {channel.discord_channel_type === "forum" && <MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                        {channel.discord_channel_type === "voice" && <Volume2 className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{channel.discord_channel_name}</p>
                          <p className="text-[10px] text-gray-500 capitalize">{channel.discord_channel_type}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => updateChannelAllowed(channel.discord_channel_id, !channel.allowed)}
                        disabled={updatingChannelId === channel.discord_channel_id}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full border border-white/15 transition ${
                          channel.allowed ? "bg-[#22c55e]" : "bg-black/40"
                        } ${updatingChannelId === channel.discord_channel_id ? "opacity-50" : ""}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                            channel.allowed ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  ))
              )}
            </div>

            {channels.length > 0 && channels.filter(ch => ch.discord_channel_type === "voice" || ch.discord_channel_type === "category").length > 0 && (
              <p className="text-[10px] text-gray-500 text-center">
                Voice channels and categories are hidden. Gravilo only responds in text channels.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
