import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Flame, BookOpen, Trophy, Calendar, Timer as TimerIcon, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const [streak, setStreak] = useState(0);
  const [todayHw, setTodayHw] = useState<any[]>([]);
  const [todaySlots, setTodaySlots] = useState<any[]>([]);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [nextExam, setNextExam] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const dow = new Date().getDay();

      const [{ data: s }, { data: hw }, { data: slots }, { data: sessions }, { data: exam }] = await Promise.all([
        supabase.from("streaks").select("current_streak").eq("user_id", user.id).maybeSingle(),
        supabase.from("homework").select("*, subjects(name, color)").eq("user_id", user.id).eq("due_date", today).eq("completed", false),
        supabase.from("timetable_slots").select("*, subjects(name, color)").eq("user_id", user.id).eq("day_of_week", dow).order("start_time"),
        supabase.from("study_sessions").select("duration_minutes").eq("user_id", user.id).gte("completed_at", startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()),
        supabase.from("exams").select("*, subjects(name)").eq("user_id", user.id).gte("exam_date", today).order("exam_date").limit(1).maybeSingle(),
      ]);

      setStreak(s?.current_streak || 0);
      setTodayHw(hw || []);
      setTodaySlots(slots || []);
      setWeekMinutes((sessions || []).reduce((sum, x: any) => sum + x.duration_minutes, 0));
      setNextExam(exam);

      // leaderboard top 5
      const wkStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
      const { data: allSessions } = await supabase.from("study_sessions").select("user_id, duration_minutes").gte("completed_at", wkStart);
      const totals: Record<string, number> = {};
      (allSessions || []).forEach((s: any) => { totals[s.user_id] = (totals[s.user_id] || 0) + s.duration_minutes; });
      const ids = Object.keys(totals);
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const ranked = ids.map(id => ({
        id, minutes: totals[id],
        name: profs?.find(p => p.id === id)?.display_name || "Student",
      })).sort((a, b) => b.minutes - a.minutes).slice(0, 5);
      setLeaders(ranked);
    })();
  }, [user]);

  const daysUntilExam = nextExam ? Math.ceil((new Date(nextExam.exam_date).getTime() - Date.now()) / 86400000) : 0;
  const maxMin = Math.max(...leaders.map(l => l.minutes), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back 👋</h1>
        <p className="text-muted-foreground">Here's your day at a glance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Flame} label="Current streak" value={`${streak} ${streak === 1 ? "day" : "days"}`} accent="accent" />
        <StatCard icon={TimerIcon} label="This week" value={`${Math.floor(weekMinutes / 60)}h ${weekMinutes % 60}m`} />
        <StatCard icon={BookOpen} label="Due today" value={`${todayHw.length}`} />
        <StatCard icon={GraduationCap} label="Next exam" value={nextExam ? `${daysUntilExam}d` : "—"} sub={nextExam?.name} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 bg-gradient-card border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /><h2 className="font-semibold">Today's timetable</h2></div>
            <Link to="/timetable"><Button variant="ghost" size="sm">Edit</Button></Link>
          </div>
          {todaySlots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No classes scheduled today.</p>
          ) : (
            <div className="space-y-2">
              {todaySlots.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40">
                  <div className="w-1 h-10 rounded-full" style={{ background: s.subjects?.color || "#7c6ff7" }} />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{s.subjects?.name || "Subject"}</div>
                    <div className="text-xs text-muted-foreground">{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 bg-gradient-card border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-accent" /><h2 className="font-semibold">Leaderboard</h2></div>
            <Link to="/leaderboard"><Button variant="ghost" size="sm">All</Button></Link>
          </div>
          {leaders.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No data yet.</p> : (
            <div className="space-y-2">
              {leaders.map((l, i) => {
                const isMe = l.id === user?.id;
                return (
                  <div key={l.id} className={`flex items-center gap-3 p-2 rounded-lg ${isMe ? "bg-primary/10 border border-primary/30" : ""}`}>
                    <span className="text-sm font-bold text-muted-foreground w-5">#{i + 1}</span>
                    <div className="w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center">
                      {l.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{l.name}{isMe && " (you)"}</div>
                      <div className="h-1 mt-1 rounded-full bg-secondary overflow-hidden"><div className="h-full gradient-primary" style={{ width: `${(l.minutes / maxMin) * 100}%` }} /></div>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{Math.floor(l.minutes / 60)}h</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5 bg-gradient-card border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /><h2 className="font-semibold">Due today</h2></div>
          <Link to="/homework"><Button variant="ghost" size="sm">All</Button></Link>
        </div>
        {todayHw.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">All clear for today 🎉</p> : (
          <div className="space-y-2">
            {todayHw.map(h => (
              <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40">
                <div className="w-1 h-8 rounded-full" style={{ background: h.subjects?.color || "#7c6ff7" }} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{h.title}</div>
                  <div className="text-xs text-muted-foreground">{h.subjects?.name || "—"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }: any) {
  return (
    <Card className="p-4 bg-gradient-card border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`w-4 h-4 ${accent === "accent" ? "text-accent" : "text-primary"}`} />
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground truncate mt-1">{sub}</div>}
    </Card>
  );
}
