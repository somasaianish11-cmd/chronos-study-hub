import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user, refreshProfile } = useAuth();
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
        let safeSubjectId: string | null = null;
        if (subjectId && subjectId.trim() !== "") {
          const { data: subject } = await supabase
            .from("subjects")
            .select("id")
            .eq("id", subjectId)
            .eq("user_id", user.id)
            .maybeSingle();
          safeSubjectId = subject ? subject.id : null;
        }

        // Local calendar day (YYYY-MM-DD) in the learner's own timezone.
        const localDate = new Date().toLocaleDateString("en-CA");

        const { data, error } = await supabase
          .from("study_sessions")
          .insert({
            user_id: user.id,
            subject_id: safeSubjectId,
            duration_minutes: durationMin,
            local_date: localDate,
          } as any)
          .select()
          .maybeSingle();
        console.log("[Chronos] session insert", { data, error });
        if (error) {
          toast.error("Couldn't save your session", { description: error.message });
          return;
        }
        // Streaks are owned solely by the DB trigger apply_session_streak().
        // Notify mounted views to re-read from the database (single source of truth).
        window.dispatchEvent(new CustomEvent("chronos:session-complete", { detail: { durationMin } }));
        // Refresh the user's profile so any UI derived from profiles stays current.
        await refreshProfile();
        toast.success("🍅 Focus session complete!", {
          description: `+${durationMin} min logged`,
        });

      }
    } finally {
      completingRef.current = false;
    }
  }, [user, refreshProfile]);

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
