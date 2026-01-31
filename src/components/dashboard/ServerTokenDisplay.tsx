import { useServerTokens } from "@/hooks/useServerTokens";
import { Loader2, Zap, Calendar, RefreshCw, ArrowUp, Info } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ServerTokenDisplayProps {
  serverId: string | null;
  onUpgrade?: () => void;
}

export function ServerTokenDisplay({ serverId, onUpgrade }: ServerTokenDisplayProps) {
  const { tokens, isLoading, refetch } = useServerTokens(serverId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tokens) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Select a server to view AI credit usage
      </div>
    );
  }

  const usagePercentage = tokens.usagePercentage;
  const remainingPercentage = 100 - usagePercentage;
  
  // Color coding based on usage
  const getProgressColor = () => {
    if (usagePercentage >= 85) return "bg-destructive";
    if (usagePercentage >= 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getTextColor = () => {
    if (usagePercentage >= 85) return "text-destructive";
    if (usagePercentage >= 50) return "text-yellow-500";
    return "text-green-500";
  };

  // Calculate days until reset
  const periodEnd = parseISO(tokens.periodEnd);
  const daysUntilReset = differenceInDays(periodEnd, new Date());
  const showRolloverPreview = daysUntilReset <= 5 && daysUntilReset >= 0;

  // Calculate rollover credits (max 20% of base can rollover)
  const maxRollover = Math.floor(tokens.baseTokens * 0.2 / tokens.tokensPerCredit);
  const potentialRollover = Math.min(tokens.creditsRemaining, maxRollover);

  // Calculate rollover portion of progress bar
  const rolloverTokens = tokens.rolloverTokens || 0;
  const rolloverCredits = Math.floor(rolloverTokens / tokens.tokensPerCredit);
  const rolloverPercentage = (rolloverTokens / tokens.tokensGranted) * 100;

  const showUpgradeCTA = tokens.plan === "free" && usagePercentage > 70;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-medium text-foreground">AI Credits</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${getTextColor()}`}>
            {tokens.creditsRemaining.toLocaleString()}
          </span>
          <span className="text-muted-foreground">
            of {tokens.creditsGranted.toLocaleString()}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh credit status</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Progress bar with rollover indicator */}
      <div className="relative">
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          {/* Rollover credits section (darker) */}
          {rolloverCredits > 0 && (
            <div
              className="absolute h-full bg-primary/30 rounded-l-full"
              style={{ width: `${rolloverPercentage}%` }}
            />
          )}
          {/* Remaining credits section */}
          <div
            className={`h-full ${getProgressColor()} transition-all duration-500`}
            style={{ width: `${remainingPercentage}%` }}
          />
        </div>
        {rolloverCredits > 0 && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>Includes {rolloverCredits} rollover credits</span>
          </div>
        )}
      </div>

      {/* Rollover preview banner */}
      {showRolloverPreview && potentialRollover > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <RefreshCw className="h-4 w-4 text-primary" />
          <span className="text-sm text-foreground">
            <span className="font-medium">{potentialRollover} credits</span>
            {" "}will carry over to next period
            {daysUntilReset > 0 && (
              <span className="text-muted-foreground">
                {" "}(in {daysUntilReset} day{daysUntilReset !== 1 ? "s" : ""})
              </span>
            )}
          </span>
        </div>
      )}

      {/* Info lines */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant={tokens.plan === "premium" ? "default" : "secondary"}>
          {tokens.plan === "premium" ? "Premium" : "Free Plan"}
        </Badge>
        
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>Resets {format(periodEnd, "MMM d, yyyy")}</span>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-muted-foreground cursor-help">
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Up to {maxRollover} can rollover</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Unused credits (up to 20% of your base allowance) automatically carry over to your next billing period.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Upgrade CTA for free servers with high usage */}
      {showUpgradeCTA && onUpgrade && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-accent">
          <div className="flex items-center gap-2 text-sm">
            <ArrowUp className="h-4 w-4 text-primary" />
            <span className="text-foreground">
              Running low? Get 10x more credits with Premium
            </span>
          </div>
          <Button size="sm" onClick={onUpgrade}>
            Upgrade
          </Button>
        </div>
      )}
    </div>
  );
}
