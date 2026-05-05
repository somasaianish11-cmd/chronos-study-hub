import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { bumpStreak } from "@/lib/streaks";
import { toast } from "sonner";

const STORAGE_KEY = "chronos.timer.v1";

type Persisted = {
  durationMin: number;
  selectedPreset: string;
  customMin: string;
  subjectId: string;
  running: boolean;
  // when running: epoch ms when timer should hit 0. when paused: null
  endsAt: number | null;
  // when paused: seconds remaining. when running: null
  pausedSecondsLeft: number | null;
};

type TimerContextValue = {
  durationMin: number;
  selectedPreset: string;
  customMin: string;
  setCustomMin: (v: string) => void;
  subjectId: string;
  setSubjectId: (id: string) => void;
  secondsLeft: number;
  running: boolean;
  selectPreset: (label: string, minutes: number) => void;
  setSelectedPreset: (label: string) => void;
  applyCustom: () => void;
  toggleRunning: () => void;
  reset: () => void;
};

const TimerContext = createContext<TimerContextValue | null>(null);

const loadPersisted = (): Persisted => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    durationMin: 25,
    selectedPreset: "25m",
    customMin: "30",
    subjectId: "",
    running: false,
    endsAt: null,
    pausedSecondsLeft: 25 * 60,
  };
};

const computeSecondsLeft = (p: Persisted): number => {
  if (p.running && p.endsAt) {
    return Math.max(0, Math.round((p.endsAt - Date.now()) / 1000));
  }
  return p.pausedSecondsLeft ?? p.durationMin * 60;
};

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<Persisted>(() => loadPersisted());
  const [secondsLeft, setSecondsLeft] = useState<number>(() => computeSecondsLeft(loadPersisted()));
  const intRef = useRef<number | null>(null);
  const completingRef = useRef(false);

  // persist state on every change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const complete = useCallback(async (durationMin: number, subjectId: string) => {
    if (completingRef.current) return;
    completingRef.current = true;
    try {
      if (user) {
        await supabase.from("study_sessions").insert({
          user_id: user.id,
          subject_id: subjectId || null,
          duration_minutes: durationMin,
        });
        const newStreak = await bumpStreak(user.id);
        toast.success("🍅 Focus session complete!", {
          description: `+${durationMin} min logged · ${newStreak} day streak`,
        });
      }
    } finally {
      completingRef.current = false;
    }
  }, [user]);

  // tick loop — derives secondsLeft from endsAt so it survives navigation
  useEffect(() => {
    if (intRef.current) { window.clearInterval(intRef.current); intRef.current = null; }
    if (!state.running || !state.endsAt) {
      setSecondsLeft(state.pausedSecondsLeft ?? state.durationMin * 60);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.round((state.endsAt! - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        const dur = state.durationMin;
        const sid = state.subjectId;
        setState(s => ({
          ...s,
          running: false,
          endsAt: null,
          pausedSecondsLeft: dur * 60,
        }));
        complete(dur, sid);
      }
    };
    tick();
    intRef.current = window.setInterval(tick, 250);
    return () => { if (intRef.current) window.clearInterval(intRef.current); };
  }, [state.running, state.endsAt, state.durationMin, state.subjectId, complete]);

  const selectPreset = (label: string, minutes: number) => {
    setState(s => ({
      ...s,
      selectedPreset: label,
      durationMin: minutes,
      running: false,
      endsAt: null,
      pausedSecondsLeft: minutes * 60,
    }));
  };

  const setSelectedPreset = (label: string) => {
    setState(s => ({ ...s, selectedPreset: label }));
  };

  const applyCustom = () => {
    const n = parseInt(state.customMin, 10);
    if (!n || n <= 0 || n > 600) {
      toast.error("Enter a valid duration (1-600 minutes)");
      return;
    }
    setState(s => ({
      ...s,
      selectedPreset: "Custom",
      durationMin: n,
      running: false,
      endsAt: null,
      pausedSecondsLeft: n * 60,
    }));
  };

  const setCustomMin = (v: string) => setState(s => ({ ...s, customMin: v }));
  const setSubjectId = (id: string) => setState(s => ({ ...s, subjectId: id }));

  const toggleRunning = () => {
    setState(s => {
      if (s.running) {
        const left = s.endsAt ? Math.max(0, Math.round((s.endsAt - Date.now()) / 1000)) : s.durationMin * 60;
        return { ...s, running: false, endsAt: null, pausedSecondsLeft: left };
      } else {
        const left = s.pausedSecondsLeft ?? s.durationMin * 60;
        return { ...s, running: true, endsAt: Date.now() + left * 1000, pausedSecondsLeft: null };
      }
    });
  };

  const reset = () => {
    setState(s => ({
      ...s,
      running: false,
      endsAt: null,
      pausedSecondsLeft: s.durationMin * 60,
    }));
  };

  return (
    <TimerContext.Provider value={{
      durationMin: state.durationMin,
      selectedPreset: state.selectedPreset,
      customMin: state.customMin,
      setCustomMin,
      subjectId: state.subjectId,
      setSubjectId,
      secondsLeft,
      running: state.running,
      selectPreset,
      setSelectedPreset,
      applyCustom,
      toggleRunning,
      reset,
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}
