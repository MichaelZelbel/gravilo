import { useCallback } from "react";
import { useServerTokens, ServerTokens } from "@/hooks/useServerTokens";
import { toast } from "@/hooks/use-toast";

interface UseServerTokenGateResult {
  hasTokens: boolean;
  isLoading: boolean;
  checkTokens: () => boolean;
  tokens: ServerTokens | null;
  refetchTokens: () => Promise<void>;
}

export function useServerTokenGate(serverId: string | null): UseServerTokenGateResult {
  const { tokens, isLoading, error, refetch } = useServerTokens(serverId);

  // Derived state: has tokens remaining
  const hasTokens = isLoading ? true : (tokens?.tokensRemaining ?? 0) > 0;

  const checkTokens = useCallback((): boolean => {
    // Fail-open while loading - server will validate
    if (isLoading) {
      return true;
    }

    // If no tokens data (error or no server), allow but server will catch
    if (!tokens) {
      return true;
    }

    // Check if tokens remaining
    if (tokens.tokensRemaining <= 0) {
      const upgradeMessage = tokens.plan === "free"
        ? "Upgrade to Premium for more credits."
        : "Wait for your billing period to reset or contact support.";

      toast({
        title: "AI Credit Limit Reached",
        description: `This server has reached its AI credit limit. ${upgradeMessage}`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  }, [isLoading, tokens]);

  return {
    hasTokens,
    isLoading,
    checkTokens,
    tokens,
    refetchTokens: refetch,
  };
}
