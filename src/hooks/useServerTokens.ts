import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ServerTokens {
  serverId: string;
  plan: "free" | "premium";
  tokensGranted: number;
  tokensUsed: number;
  tokensRemaining: number;
  tokensPerCredit: number;
  creditsGranted: number;
  creditsUsed: number;
  creditsRemaining: number;
  periodStart: string;
  periodEnd: string;
  rolloverTokens: number;
  baseTokens: number;
  atLimit: boolean;
  usagePercentage: number;
}

interface UseServerTokensResult {
  tokens: ServerTokens | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Track which servers have shown low credit warning this session
const warnedServersThisSession = new Set<string>();

export function useServerTokens(serverId: string | null): UseServerTokensResult {
  const [tokens, setTokens] = useState<ServerTokens | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ref to track if we've checked warning for current fetch
  const lastCheckedServerRef = useRef<string | null>(null);

  const fetchTokenStatus = useCallback(async () => {
    if (!serverId) {
      setTokens(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setError("Not authenticated");
        setIsLoading(false);
        return;
      }

      const response = await supabase.functions.invoke("get-server-token-status", {
        body: { server_id: serverId },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (response.error) {
        console.error("Token status error:", response.error);
        setError(response.error.message || "Failed to fetch token status");
        setIsLoading(false);
        return;
      }

      const data = response.data;

      const tokenData: ServerTokens = {
        serverId: data.server_id,
        plan: data.plan,
        tokensGranted: data.tokens_granted,
        tokensUsed: data.tokens_used,
        tokensRemaining: data.tokens_remaining,
        tokensPerCredit: data.tokens_per_credit,
        creditsGranted: data.credits_granted,
        creditsUsed: data.credits_used,
        creditsRemaining: data.credits_remaining,
        periodStart: data.period_start,
        periodEnd: data.period_end,
        rolloverTokens: data.rollover_tokens,
        baseTokens: data.base_tokens,
        atLimit: data.at_limit,
        usagePercentage: data.usage_percentage,
      };

      setTokens(tokenData);

      // Show low credit warning if > 85% used and not already warned this session
      if (
        tokenData.usagePercentage > 85 &&
        !warnedServersThisSession.has(serverId) &&
        lastCheckedServerRef.current !== serverId
      ) {
        warnedServersThisSession.add(serverId);
        lastCheckedServerRef.current = serverId;

        const upgradeMessage = tokenData.plan === "free"
          ? "Consider upgrading to Premium for more."
          : "You're running low on credits for this billing period.";

        toast({
          title: "Low AI Credits",
          description: `This server has ${tokenData.creditsRemaining} credits remaining. ${upgradeMessage}`,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error fetching token status:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  // Fetch on mount and when serverId changes
  useEffect(() => {
    fetchTokenStatus();
  }, [fetchTokenStatus]);

  return {
    tokens,
    isLoading,
    error,
    refetch: fetchTokenStatus,
  };
}
