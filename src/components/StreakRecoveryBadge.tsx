import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { utcMondayOf } from "@/lib/streaks";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const dayStr = (d: Date) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};

/** Pro streak recovery badge. Clickable when this week's recovery is still available. */
export default function StreakRecoveryBadge({ className }: { className?: string }) {
  const { user, isPro, refreshProfile } = useAuth();
  const [used, setUsed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"restore" | "manual">("restore");
  const [manualDays, setManualDays] = useState("1");
  const [claiming, setClaiming] = useState(false);

  const fetchUsed = useCallback(() => {
    if (!user || !isPro) return;
    let active = true;
    // select("*") so a missing optional column never 400s; null row = not used.
    supabase
      .from("streaks")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { console.warn("[Streak] recovery fetch failed:", error.message); setUsed(false); return; }
        setUsed((data as any)?.recovery_used_week === utcMondayOf(new Date()));
      });
    return () => { active = false; };
  }, [user, isPro]);

  useEffect(() => {
    const cleanup = fetchUsed();
    const onComplete = () => fetchUsed();
    window.addEventListener("chronos:session-complete", onComplete);
    return () => {
      cleanup?.();
      window.removeEventListener("chronos:session-complete", onComplete);
    };
  }, [fetchUsed]);

  if (!isPro || used === null) return null;

  const claimRecovery = async () => {
    if (!user || claiming) return;
    const days = mode === "restore" ? 3 : Math.max(1, Math.min(30, parseInt(manualDays, 10) || 1));
    setClaiming(true);
    try {
      const { data: row, error: fetchErr } = await supabase
        .from("streaks")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;

      const today = dayStr(new Date());
      const weekStart = utcMondayOf(new Date());
      const current = Number((row as any)?.current_streak) || 0;
      const longest = Number((row as any)?.longest_streak) || 0;
      const newStreak = current + days;

      const payload = {
        current_streak: newStreak,
        longest_streak: Math.max(newStreak, longest),
        last_study_date: today,
        recovery_used_week: weekStart,
        updated_at: new Date().toISOString(),
      };

      const { error } = row
        ? await supabase.from("streaks").update(payload).eq("user_id", user.id)
        : await supabase.from("streaks").insert({ user_id: user.id, ...payload });
      if (error) throw error;

      setUsed(true);
      setOpen(false);
      toast.success(`Streak recovered! +${days} day${days === 1 ? "" : "s"} restored 🔥`);
      // Refresh dashboard state immediately.
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
        used
          ? "border-border bg-muted text-muted-foreground"
          : "border-primary/40 bg-primary/10 text-primary",
        className
      )}
    >
      <LifeBuoy className="w-3.5 h-3.5" />
      {used ? "Recovery used this week" : "1/1 Streak Recovery available"}
    </span>
  );

  if (used) {
    return <span title="Pro members get one streak recovery per week, resetting Monday 00:00 UTC.">{badge}</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
        title="Claim your weekly streak recovery"
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
              You have <span className="font-semibold text-foreground">1/1</span> recovery item available this week.
              It resets Monday 00:00 UTC.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <button
              type="button"
              onClick={() => setMode("restore")}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition-colors",
                mode === "restore" ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
              )}
            >
              <div className="flex items-center gap-2 font-medium">
                <Flame className="w-4 h-4 text-primary" /> Restore Previous Streak (+3 Days)
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Add back the 3 days you lost when your streak broke.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode("manual")}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition-colors",
                mode === "manual" ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
              )}
            >
              <div className="font-medium">Manual adjustment</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Missed a different number of days? Enter how many to restore.
              </p>
              {mode === "manual" && (
                <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Label htmlFor="manual-days" className="text-xs">Days:</Label>
                  <Input
                    id="manual-days"
                    type="number"
                    min={1}
                    max={30}
                    value={manualDays}
                    onChange={(e) => setManualDays(e.target.value)}
                    className="h-8 w-20"
                  />
                </div>
              )}
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={claiming}>
              Cancel
            </Button>
            <Button onClick={claimRecovery} disabled={claiming}>
              {claiming ? "Claiming…" : "Claim Recovery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
