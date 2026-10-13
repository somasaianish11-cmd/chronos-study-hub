import { ShieldCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Micro-copy badge shown under the timer controls. The tooltip explains that
 * sessions are tracked against absolute time, so a locked screen or sleeping
 * device never skews logged focus time or streaks.
 */
export default function UtcTrackingBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="mx-auto flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
          Background-safe UTC tracking enabled
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center" className="max-w-xs text-left leading-relaxed">
        Chronos tracks sessions using absolute universal time. Your focus time and
        streaks remain 100% accurate even if your screen locks, device sleeps, or
        tabs switch.
      </TooltipContent>
    </Tooltip>
  );
}
