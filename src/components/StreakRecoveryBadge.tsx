import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  STREAK_TABLE,
  UserStreak,
  fetchUserStreak,
  localDay,
  missedDays,
} from "@/lib/streaks";
import { claimLoggedRecovery, fetchRecoveryLogs, RecoveryLog, recoveryCountdown } from "@/lib/streakRecovery";
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
  const [logs, setLogs] = useState<RecoveryLog[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!user || !isPro) return;
    const streak = await fetchUserStreak(user.id);
    setRow(streak);
    setLoadError(!streak);
    try {
      setLogs(await fetchRecoveryLogs(user.id));
      setHistoryError(false);
    } catch {
      setLogs([]);
      setHistoryError(true);
    }
  }, [user, isPro]);

  useEffect(() => {
    load();
    const onComplete = () => load();
    window.addEventListener("chronos:session-complete", onComplete);
    return () => window.removeEventListener("chronos:session-complete", onComplete);
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (!isPro || row === undefined) return null;

  const freezes = row?.streak_freezes_available ?? row?.freeze_count ?? 0;
  const lastUsed = row?.last_recovery_used_at ?? logs[0]?.used_at ?? null;
  const missing = missedDays(row?.last_active_day ?? null);
  const available = freezes > 0;

  const claimRecovery = async () => {
    if (!user || claiming || !row) return;
    if (missing <= 0) {
      toast.info("Your streak isn't broken — nothing to restore.");
      return;
    }
    if (freezes <= 0) return;
    setClaiming(true);
    try {
      const result = await claimLoggedRecovery(localDay());
      await load();

      setOpen(false);
      toast.success(`Streak recovered! ${result.days_restored} day${result.days_restored === 1 ? "" : "s"} restored — streak is now ${result.current_streak} 🔥`);
      window.dispatchEvent(new Event("chronos:session-complete"));
      void refreshProfile?.();
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
      {available ? `${freezes} Streak Recovery available` : "0 recoveries available"}
    </span>
  );

  return (
    <>
      <section aria-label="Streak Recovery" className="max-w-full space-y-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-auto max-w-full whitespace-normal p-0 hover:bg-transparent"
        title="View streak recovery and history"
      >
        {badge}
      </Button>
      {freezes === 0 && !loadError && <p className="text-xs text-muted-foreground" role="timer">{recoveryCountdown(lastUsed, now)}</p>}
      {loadError && <p className="text-xs text-destructive">Recovery unavailable. Please try again.</p>}
      <div className="text-xs">
        <h2 className="font-medium text-foreground">Past Recoveries</h2>
        {historyError ? <p className="mt-1 text-muted-foreground">Recovery history couldn't be loaded.</p> : logs.length === 0 ? <p className="mt-1 text-muted-foreground">No past recoveries.</p> : (
          <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto">
            {logs.map(log => (
              <li key={log.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-muted-foreground">
                <time dateTime={log.used_at} title={new Date(log.used_at).toLocaleString()}>{new Date(log.used_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time>
                <span>{log.days_restored} day{log.days_restored === 1 ? "" : "s"} restored · through {log.recovered_date}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      </section>

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
              {row?.last_active_day ?? "never"}. Current streak: {row?.current_streak ?? 0} day
              {row?.current_streak === 1 ? "" : "s"}
              {missing > 0 && ` → ${(row?.current_streak ?? 0) + Math.min(freezes, missing)} after recovery`}.
            </p>
            {missing > freezes && (
              <p className="mt-2 text-xs text-foreground">
                You have {freezes} recoveries available to cover {missing} missed days. Claiming will
                restore {freezes} days of your streak.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={claiming}>
              Cancel
            </Button>
            <Button onClick={claimRecovery} disabled={claiming || missing <= 0 || freezes <= 0}>
              {claiming ? "Claiming…" : "Claim Recovery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
