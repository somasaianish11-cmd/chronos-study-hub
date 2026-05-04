import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { bumpStreak } from "@/lib/streaks";

const POMODORO = 25 * 60;

export default function TimerPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState(POMODORO);
  const [running, setRunning] = useState(false);
  const intRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("subjects").select("*").eq("user_id", user.id).order("created_at")
      .then(({ data }) => { setSubjects(data || []); if (data?.[0]) setSubjectId(data[0].id); });
  }, [user]);

  useEffect(() => {
    if (!running) return;
    intRef.current = window.setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { complete(); return POMODORO; }
        return s - 1;
      });
    }, 1000);
    return () => { if (intRef.current) window.clearInterval(intRef.current); };
    // eslint-disable-next-line
  }, [running]);

  const complete = async () => {
    setRunning(false);
    if (intRef.current) window.clearInterval(intRef.current);
    if (!user) return;
    await supabase.from("study_sessions").insert({
      user_id: user.id, subject_id: subjectId || null, duration_minutes: 25,
    });
    const newStreak = await bumpStreak(user.id);
    toast.success("🍅 Focus session complete!", { description: `+25 min logged · ${newStreak} day streak` });
  };

  const reset = () => { setRunning(false); setSecondsLeft(POMODORO); };

  const mins = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const secs = (secondsLeft % 60).toString().padStart(2, "0");
  const progress = ((POMODORO - secondsLeft) / POMODORO) * 100;
  const radius = 130, circ = 2 * Math.PI * radius;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Focus Timer</h1>
        <p className="text-muted-foreground">25-minute Pomodoro session</p>
      </div>

      <Card className="p-8 bg-gradient-card border-border flex flex-col items-center">
        <div className="relative w-72 h-72 my-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 300 300">
            <circle cx="150" cy="150" r={radius} stroke="hsl(var(--border))" strokeWidth="8" fill="none" />
            <circle cx="150" cy="150" r={radius} stroke="url(#g)" strokeWidth="8" fill="none"
              strokeDasharray={circ} strokeDashoffset={circ - (progress / 100) * circ} strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.5s linear" }} />
            <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(247 88% 70%)" /><stop offset="100%" stopColor="hsl(265 85% 65%)" /></linearGradient></defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-6xl font-bold tabular-nums tracking-tight">{mins}:{secs}</div>
            <div className="text-sm text-muted-foreground mt-2">{running ? "Focus" : "Ready"}</div>
          </div>
        </div>

        <div className="w-full space-y-3">
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger><SelectValue placeholder={subjects.length ? "Pick a subject" : "Add a subject first"} /></SelectTrigger>
            <SelectContent>
              {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => setRunning(r => !r)}>
              {running ? <><Pause className="w-4 h-4 mr-2" />Pause</> : <><Play className="w-4 h-4 mr-2" />{secondsLeft === POMODORO ? "Start" : "Resume"}</>}
            </Button>
            <Button size="lg" variant="outline" onClick={reset}><RotateCcw className="w-4 h-4" /></Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
