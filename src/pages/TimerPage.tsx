import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTimer } from "@/contexts/TimerContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "25m", minutes: 25 },
  { label: "45m", minutes: 45 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
];

export default function TimerPage() {
  const { user } = useAuth();
  const {
    durationMin, selectedPreset, customMin, setCustomMin,
    subjectId, setSubjectId, secondsLeft, running,
    selectPreset, setSelectedPreset, applyCustom, toggleRunning, reset,
  } = useTimer();
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("subjects").select("*").eq("user_id", user.id).order("created_at")
      .then(({ data }) => {
        setSubjects(data || []);
        if (!subjectId && data?.[0]) setSubjectId(data[0].id);
      });
    // eslint-disable-next-line
  }, [user]);

  const mins = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const secs = (secondsLeft % 60).toString().padStart(2, "0");
  const total = durationMin * 60;
  const progress = ((total - secondsLeft) / total) * 100;
  const radius = 130, circ = 2 * Math.PI * radius;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Focus Timer</h1>
        <p className="text-muted-foreground">Pick your focus length and start</p>
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
          <div className="grid grid-cols-6 gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => selectPreset(p.label, p.minutes)}
                className={cn(
                  "h-9 rounded-md text-sm font-medium border transition-colors",
                  selectedPreset === p.label
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-accent"
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setSelectedPreset("Custom")}
              className={cn(
                "h-9 rounded-md text-sm font-medium border transition-colors",
                selectedPreset === "Custom"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-accent"
              )}
            >
              Custom
            </button>
          </div>

          {selectedPreset === "Custom" && (
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={600}
                value={customMin}
                onChange={e => setCustomMin(e.target.value)}
                placeholder="Minutes"
              />
              <Button variant="outline" onClick={applyCustom}>Set</Button>
            </div>
          )}

          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger><SelectValue placeholder={subjects.length ? "Pick a subject" : "Add a subject first"} /></SelectTrigger>
            <SelectContent>
              {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={toggleRunning}>
              {running ? <><Pause className="w-4 h-4 mr-2" />Pause</> : <><Play className="w-4 h-4 mr-2" />{secondsLeft === durationMin * 60 ? "Start" : "Resume"}</>}
            </Button>
            <Button size="lg" variant="outline" onClick={reset}><RotateCcw className="w-4 h-4" /></Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
