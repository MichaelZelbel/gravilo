import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Server, Calendar, Loader2, X, Save, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Json } from "@/integrations/supabase/types";

interface ServerWithAllowance {
  id: string;
  discord_guild_id: string;
  name: string;
  icon_url: string | null;
  plan: string;
  allowance: {
    id: string;
    tokens_granted: number;
    tokens_used: number;
    period_start: string;
    period_end: string;
    source: string | null;
    metadata: Json;
  } | null;
}

interface AllowanceMetadata {
  base_tokens?: number;
  rollover_tokens?: number;
  plan?: string;
}

export function ServerTokenManagement() {
  const [servers, setServers] = useState<ServerWithAllowance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<ServerWithAllowance | null>(null);
  const [editedAllowance, setEditedAllowance] = useState<{
    tokens_granted: number;
    tokens_used: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [tokensPerCredit, setTokensPerCredit] = useState(200);
  const { toast } = useToast();

  useEffect(() => {
    fetchServers();
    fetchTokensPerCredit();
  }, []);

  const fetchTokensPerCredit = async () => {
    const { data } = await supabase
      .from("ai_credit_settings")
      .select("value_int")
      .eq("key", "tokens_per_credit")
      .single();
    
    if (data) {
      setTokensPerCredit(data.value_int);
    }
  };

  const fetchServers = async () => {
    setLoading(true);

    // Fetch all servers with their plans
    const { data: serversData, error: serversError } = await supabase
      .from("servers")
      .select("id, discord_guild_id, name, icon_url")
      .order("name");

    if (serversError) {
      console.error("Error fetching servers:", serversError);
      setLoading(false);
      return;
    }

    // Fetch server plans
    const { data: plansData } = await supabase
      .from("server_plans")
      .select("server_id, plan");

    const plansMap: Record<string, string> = {};
    (plansData || []).forEach((p) => {
      plansMap[p.server_id] = p.plan;
    });

    // Fetch current allowances
    const { data: allowancesData } = await supabase
      .from("server_token_allowances")
      .select("*")
      .gte("period_end", new Date().toISOString())
      .lte("period_start", new Date().toISOString());

    const allowancesMap: Record<string, ServerWithAllowance["allowance"]> = {};
    (allowancesData || []).forEach((a) => {
      allowancesMap[a.server_id] = {
        id: a.id,
        tokens_granted: a.tokens_granted || 0,
        tokens_used: a.tokens_used || 0,
        period_start: a.period_start,
        period_end: a.period_end,
        source: a.source,
        metadata: a.metadata || {},
      };
    });

    const serversWithData: ServerWithAllowance[] = (serversData || []).map((s) => ({
      ...s,
      plan: plansMap[s.id] || "free",
      allowance: allowancesMap[s.discord_guild_id] || null,
    }));

    setServers(serversWithData);
    setLoading(false);
  };

  const openServerModal = (server: ServerWithAllowance) => {
    setSelectedServer(server);
    if (server.allowance) {
      setEditedAllowance({
        tokens_granted: server.allowance.tokens_granted,
        tokens_used: server.allowance.tokens_used,
      });
    } else {
      setEditedAllowance({ tokens_granted: 0, tokens_used: 0 });
    }
  };

  const closeModal = () => {
    setSelectedServer(null);
    setEditedAllowance(null);
  };

  const saveAllowance = async () => {
    if (!selectedServer || !editedAllowance) return;

    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const adminEmail = session?.user?.email || "unknown";

      if (selectedServer.allowance) {
        // Calculate delta for logging
        const tokensDelta = editedAllowance.tokens_granted - selectedServer.allowance.tokens_granted;
        const usedDelta = editedAllowance.tokens_used - selectedServer.allowance.tokens_used;

        // Update existing allowance
        const { error: updateError } = await supabase
          .from("server_token_allowances")
          .update({
            tokens_granted: editedAllowance.tokens_granted,
            tokens_used: editedAllowance.tokens_used,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedServer.allowance.id);

        if (updateError) {
          throw updateError;
        }

        // Log adjustment event
        const { error: eventError } = await supabase
          .from("server_token_events")
          .insert({
            server_id: selectedServer.discord_guild_id,
            feature: "admin_adjustment",
            total_tokens: tokensDelta,
            prompt_tokens: 0,
            completion_tokens: 0,
            credits_charged: Math.floor(tokensDelta / tokensPerCredit),
            idempotency_key: `admin-${selectedServer.discord_guild_id}-${Date.now()}`,
            metadata: {
              admin_email: adminEmail,
              adjustment_type: "manual",
              tokens_granted_before: selectedServer.allowance.tokens_granted,
              tokens_granted_after: editedAllowance.tokens_granted,
              tokens_used_before: selectedServer.allowance.tokens_used,
              tokens_used_after: editedAllowance.tokens_used,
              tokens_delta: tokensDelta,
              used_delta: usedDelta,
            },
          });

        if (eventError) {
          console.error("Failed to log event:", eventError);
          // Don't fail the save if logging fails
        }

        // Update local state
        setServers((prev) =>
          prev.map((s) =>
            s.id === selectedServer.id
              ? {
                  ...s,
                  allowance: {
                    ...s.allowance!,
                    tokens_granted: editedAllowance.tokens_granted,
                    tokens_used: editedAllowance.tokens_used,
                  },
                }
              : s
          )
        );

        toast({ title: "Success", description: "Server allowance updated" });
      } else {
        // Create new allowance
        const now = new Date();
        const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

        const { data: newAllowance, error: insertError } = await supabase
          .from("server_token_allowances")
          .insert({
            server_id: selectedServer.discord_guild_id,
            tokens_granted: editedAllowance.tokens_granted,
            tokens_used: editedAllowance.tokens_used,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            source: "admin_manual",
            metadata: {
              base_tokens: editedAllowance.tokens_granted,
              rollover_tokens: 0,
              plan: selectedServer.plan,
              created_by: adminEmail,
            },
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        // Log creation event
        await supabase.from("server_token_events").insert({
          server_id: selectedServer.discord_guild_id,
          feature: "admin_adjustment",
          total_tokens: editedAllowance.tokens_granted,
          prompt_tokens: 0,
          completion_tokens: 0,
          credits_charged: 0,
          idempotency_key: `admin-create-${selectedServer.discord_guild_id}-${Date.now()}`,
          metadata: {
            admin_email: adminEmail,
            adjustment_type: "create",
            tokens_granted: editedAllowance.tokens_granted,
            tokens_used: editedAllowance.tokens_used,
          },
        });

        // Update local state
        setServers((prev) =>
          prev.map((s) =>
            s.id === selectedServer.id
              ? {
                  ...s,
                  allowance: {
                    id: newAllowance.id,
                    tokens_granted: editedAllowance.tokens_granted,
                    tokens_used: editedAllowance.tokens_used,
                    period_start: periodStart.toISOString(),
                    period_end: periodEnd.toISOString(),
                    source: "admin_manual",
                    metadata: {},
                  },
                }
              : s
          )
        );

        toast({ title: "Success", description: "Server allowance created" });
      }

      closeModal();
    } catch (error) {
      console.error("Error saving allowance:", error);
      toast({ title: "Error", description: "Failed to save allowance", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getUsagePercentage = (allowance: ServerWithAllowance["allowance"]) => {
    if (!allowance || allowance.tokens_granted === 0) return 0;
    return Math.min(100, Math.round((allowance.tokens_used / allowance.tokens_granted) * 100));
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 85) return "bg-red-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-[#3BFFB6]";
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-400">Loading servers...</span>
        </div>
      </div>
    );
  }

  const parseMetadata = (metadata: Json): AllowanceMetadata => {
    if (typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata)) {
      return metadata as unknown as AllowanceMetadata;
    }
    return {};
  };

  return (
    <>
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-[#5865F2]" />
            <h2 className="text-lg font-semibold">Server Token Management</h2>
          </div>
          <Button
            onClick={fetchServers}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-3">Server</th>
                <th className="px-6 py-3">Discord ID</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Usage</th>
                <th className="px-6 py-3">Period End</th>
              </tr>
            </thead>
            <tbody>
              {servers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    No servers found
                  </td>
                </tr>
              ) : (
                servers.map((server) => {
                  const percentage = getUsagePercentage(server.allowance);
                  return (
                    <tr
                      key={server.id}
                      onClick={() => openServerModal(server)}
                      className="border-b border-white/5 hover:bg-white/5 transition cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {server.icon_url ? (
                            <img
                              src={server.icon_url}
                              alt={server.name}
                              className="h-8 w-8 rounded-full"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-[#5865F2]/20 flex items-center justify-center">
                              <Server className="h-4 w-4 text-[#5865F2]" />
                            </div>
                          )}
                          <span className="text-sm font-medium">{server.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400 font-mono">
                        {server.discord_guild_id}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs border ${
                            server.plan === "premium"
                              ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                              : "bg-gray-500/20 text-gray-300 border-gray-500/30"
                          }`}
                        >
                          {server.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {server.allowance ? (
                          <div className="w-40">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span>{formatTokens(server.allowance.tokens_used)}</span>
                              <span>{formatTokens(server.allowance.tokens_granted)}</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${getProgressColor(percentage)}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">No allowance</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {server.allowance ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(server.allowance.period_end), "MMM d, yyyy")}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!selectedServer} onOpenChange={() => closeModal()}>
        <DialogContent className="bg-[#0a0f1a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedServer?.icon_url ? (
                <img
                  src={selectedServer.icon_url}
                  alt={selectedServer.name}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-[#5865F2]/20 flex items-center justify-center">
                  <Server className="h-4 w-4 text-[#5865F2]" />
                </div>
              )}
              <span>{selectedServer?.name}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedServer && editedAllowance && (
            <div className="space-y-6 mt-4">
              {/* Period Info */}
              {selectedServer.allowance && (
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Period Start</p>
                    <p className="text-sm">
                      {format(new Date(selectedServer.allowance.period_start), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Period End</p>
                    <p className="text-sm">
                      {format(new Date(selectedServer.allowance.period_end), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              )}

              {/* Editable Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Tokens Granted
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={editedAllowance.tokens_granted}
                    onChange={(e) =>
                      setEditedAllowance((prev) => ({
                        ...prev!,
                        tokens_granted: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="bg-white/5 border-white/20 text-gray-200"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    = {Math.floor(editedAllowance.tokens_granted / tokensPerCredit)} credits
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Tokens Used
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={editedAllowance.tokens_used}
                    onChange={(e) =>
                      setEditedAllowance((prev) => ({
                        ...prev!,
                        tokens_used: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="bg-white/5 border-white/20 text-gray-200"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    = {Math.floor(editedAllowance.tokens_used / tokensPerCredit)} credits used
                  </p>
                </div>
              </div>

              {/* Calculated Credits */}
              <div className="p-4 rounded-xl bg-[#3BFFB6]/10 border border-[#3BFFB6]/20">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Credits Remaining</span>
                  <span className="text-lg font-bold text-[#3BFFB6]">
                    {Math.floor(
                      (editedAllowance.tokens_granted - editedAllowance.tokens_used) /
                        tokensPerCredit
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                  <span>Tokens Remaining</span>
                  <span>
                    {(
                      editedAllowance.tokens_granted - editedAllowance.tokens_used
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Rollover Info */}
              {selectedServer.allowance && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-gray-400 mb-2">Metadata</p>
                  <div className="space-y-1 text-sm">
                    {(() => {
                      const meta = parseMetadata(selectedServer.allowance.metadata);
                      return (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Base Tokens:</span>
                            <span>{(meta.base_tokens || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Rollover Tokens:</span>
                            <span>{(meta.rollover_tokens || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Source:</span>
                            <span>{selectedServer.allowance?.source || "unknown"}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <Button
                  variant="ghost"
                  onClick={closeModal}
                  className="text-gray-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveAllowance}
                  disabled={saving}
                  className="bg-[#3BFFB6] hover:bg-[#2ee8a5] text-black"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
