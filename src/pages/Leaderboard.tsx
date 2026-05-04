import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { startOfWeek } from "date-fns";

export default function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const wkStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
      const { data: sessions } = await supabase.from("study_sessions").select("user_id, duration_minutes").gte("completed_at", wkStart);
      const totals: Record<string, number> = {};
      (sessions || []).forEach((s: any) => { totals[s.user_id] = (totals[s.user_id] || 0) + s.duration_minutes; });
      const ids = Object.keys(totals);
      if (!ids.length) return setRows([]);
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      setRows(ids.map(id => ({ id, minutes: totals[id], name: profs?.find(p => p.id === id)?.display_name || "Student" })).sort((a, b) => b.minutes - a.minutes));
    })();
  }, []);

  const max = Math.max(...rows.map(r => r.minutes), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Weekly Leaderboard</h1>
        <p className="text-muted-foreground">Total study hours this week</p>
      </div>

      {rows.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card border-border">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No sessions logged yet this week.</p>
        </Card>
      ) : (
        <Card className="p-5 bg-gradient-card border-border">
          <div className="space-y-2">
            {rows.map((r, i) => {
              const isMe = r.id === user?.id;
              return (
                <div key={r.id} className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${isMe ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/40"}`}>
                  <span className={`text-sm font-bold w-6 ${i < 3 ? "text-accent" : "text-muted-foreground"}`}>#{i + 1}</span>
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary text-sm font-semibold flex items-center justify-center">
                    {r.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{r.name}{isMe && <span className="text-xs text-primary ml-2">you</span>}</div>
                    <div className="h-1.5 mt-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full gradient-primary transition-all" style={{ width: `${(r.minutes / max) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="font-semibold text-sm">{Math.floor(r.minutes / 60)}h {r.minutes % 60}m</div>
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
