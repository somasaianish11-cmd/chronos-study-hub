import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Users whose weekly totals are within this many seconds are considered tied. */
const TIE_WINDOW_SECONDS = 30;

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc("weekly_leaderboard");
      if (error) {
        console.error("[Leaderboard] rpc error", error);
        setRows([]);
        return;
      }
      const ranked = (data || [])
        .map((r: any) => ({
          id: r.user_id,
          name: r.display_name || "Student",
          minutes: Number(r.total_minutes) || 0,
          sessions: Number(r.session_count) || 0,
          joinedAt: r.joined_at ? new Date(r.joined_at).getTime() : 0,
        }))
        // deterministic order: time desc, then sessions desc, then oldest account, then id
        .sort(
          (a, b) =>
            b.minutes - a.minutes ||
            b.sessions - a.sessions ||
            a.joinedAt - b.joinedAt ||
            a.id.localeCompare(b.id)
        );
      setRows(ranked);
    };
    load();
    if (!user) return;
    const channel = supabase
      .channel(`lb-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "study_sessions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const max = Math.max(...rows.map((r) => r.minutes), 1);

  // Group users within the tie window so they share a rank instead of swapping places.
  let rank = 0;
  let groupLeaderSeconds: number | null = null;
  const display = rows.map((r, i) => {
    const seconds = r.minutes * 60;
    const tiedWithPrev =
      groupLeaderSeconds !== null && Math.abs(groupLeaderSeconds - seconds) <= TIE_WINDOW_SECONDS;
    if (!tiedWithPrev) {
      rank = i + 1;
      groupLeaderSeconds = seconds;
    }
    return { ...r, rank, tiedWithPrev };
  });
  const tiedRanks = new Set(
    display.filter((r) => r.tiedWithPrev).map((r) => r.rank)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Weekly Leaderboard</h1>
        <p className="text-muted-foreground">Total study time this week</p>
      </div>

      {rows.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card border-border">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No sessions logged yet this week.</p>
        </Card>
      ) : (
        <Card className="p-5 bg-gradient-card border-border">
          <div className="space-y-2">
            {display.map((r) => {
              const isMe = r.id === user?.id;
              return (
                <div key={r.id} className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${isMe ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/40"}`}>
                  <span className={`text-sm font-bold w-6 ${r.rank <= 3 ? "text-accent" : "text-muted-foreground"}`}>#{r.rank}</span>
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary text-sm font-semibold flex items-center justify-center">
                    {r.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{r.name}</span>
                      {isMe && <span className="text-xs text-primary">you</span>}
                      {tiedRanks.has(r.rank) && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">Tied!</Badge>
                      )}
                    </div>
                    <div className="h-1.5 mt-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full gradient-primary transition-all" style={{ width: `${(r.minutes / max) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="font-semibold text-sm">{formatMinutes(r.minutes)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
