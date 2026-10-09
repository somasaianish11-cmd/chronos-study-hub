import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  STREAK_TABLE,
  UserStreak,
  fetchUserStreak,
  localDay,
  missedDays,
  sanitizeStreakPayload,
  yesterdayOf,
} from "@/lib/streaks";
import { LifeBuoy, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Pro streak recovery badge. Clickable when a streak freeze is available. */
export default function StreakRecoveryBadge({ className }: { className?: string }) {
  const { user, isPro, refreshProfile } = useAuth();
  const [row, setRow] = useState<UserStreak | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    if (!user || !isPro) return;
    setRow(await fetchUserStreak(user.id));
  }, [user, isPro]);

  useEffect(() => {
    load();
    const onComplete = () => load();
    window.addEventListener("chronos:session-complete", onComplete);
    return () => window.removeEventListener("chronos:session-complete", onComplete);
  }, [load]);

  if (!isPro || row === undefined) return null;

  const freezes = row?.freeze_count ?? 0;
  const missing = missedDays(row?.last_active_day ?? null);
  const available = freezes > 0;

  const claimRecovery = async () => {
    if (!user || claiming || !row) return;
    if (missing <= 0) {
      toast.info("Your streak isn't broken — nothing to restore.");
      return;
    }
    if (freezes < missing) {
      toast.error(`You need ${missing} recoveries to bridge ${missing} missed days, but only have ${freezes}.`);
      return;
    }
    setClaiming(true);
    try {
      const today = localDay();
      // Actual continuous date count: the streak ran unbroken through
      // last_active_day, so bridging the gap extends it by exactly the number
      // of missed days — one freeze consumed per missed day.
      const newStreak = row.current_streak + missing;
      // Bridge the gap up to yesterday so studying today continues the chain.
      // Only the four columns user_streaks has — nothing else may be sent.
      const payload = sanitizeStreakPayload({
        current_streak: newStreak,
        last_active_day: yesterdayOf(today),
        freeze_count: Math.max(0, freezes - missing),
      });
      const { error } = await (supabase as any)
        .from(STREAK_TABLE)
        .update(payload)
        .eq("user_id", user.id);
      if (error) throw error;

      setOpen(false);
      toast.success(`Streak recovered! ${missing} day${missing === 1 ? "" : "s"} restored — streak is now ${newStreak} 🔥`);
      window.dispatchEvent(new Event("chronos:session-complete"));
      refreshProfile?.();
    } catch (e: any) {
      console.error("[Streak] recovery claim failed:", e);
      toast.error("Couldn't claim recovery. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        available
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground",
        className
      )}
    >
      <LifeBuoy className="w-3.5 h-3.5" />
      {available ? `${freezes} Streak Recovery available` : "No recoveries left"}
    </span>
  );

  if (!available || !row) return <span title="Pro members get streak recoveries to repair missed days.">{badge}</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
        title="Claim a streak recovery"
      >
        {badge}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-primary" /> Streak Recovery
            </DialogTitle>
            <DialogDescription>
              You have <span className="font-semibold text-foreground">{freezes}</span> recovery
              item{freezes === 1 ? "" : "s"} available.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border p-3 my-2">
            <div className="flex items-center gap-2 font-medium">
              <Flame className="w-4 h-4 text-primary" />
              {missing > 0
                ? `Restore ${missing} missed day${missing === 1 ? "" : "s"}`
                : "No missed days"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Last active: {row.last_active_day ?? "never"}. Current streak: {row.current_streak} day
              {row.current_streak === 1 ? "" : "s"}
              {missing > 0 && ` → ${row.current_streak + missing} after recovery`}.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={claiming}>
              Cancel
            </Button>
            <Button onClick={claimRecovery} disabled={claiming || missing <= 0}>
              {claiming ? "Claiming…" : "Claim Recovery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
