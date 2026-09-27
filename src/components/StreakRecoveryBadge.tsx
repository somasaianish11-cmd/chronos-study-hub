import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { utcMondayOf } from "@/lib/streaks";
import { LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shows the Pro user's remaining weekly streak recovery. Renders nothing for free users. */
export default function StreakRecoveryBadge({ className }: { className?: string }) {
  const { user, isPro } = useAuth();
  const [used, setUsed] = useState<boolean | null>(null);

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

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        used
          ? "border-border bg-muted text-muted-foreground"
          : "border-primary/40 bg-primary/10 text-primary",
        className
      )}
      title="Pro members get one streak recovery per week, resetting Monday 00:00 UTC."
    >
      <LifeBuoy className="w-3.5 h-3.5" />
      {used ? "Recovery used this week" : "1/1 Streak Recovery available"}
    </span>
  );
}
