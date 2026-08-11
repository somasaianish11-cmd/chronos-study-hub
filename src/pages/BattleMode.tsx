import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Swords,
  Bot,
  Users,
  Trophy,
  Flame,
  Zap,
  Copy,
  Check,
  ArrowLeft,
  Sparkles,
  Crown,
  Skull,
} from "lucide-react";
import { toast } from "sonner";

type Duration = 15 | 25 | 45;
type Mode = "bot" | "room";
type Phase = "lobby" | "countdown" | "arena" | "result";
type Outcome = "win" | "loss";

const BOT_NAMES = ["Anish", "Mira", "Kenji", "Zara", "Leo", "Nova", "Rhea", "Kai"];

export default function BattleMode() {
  const { user, isPro, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isPro) return <Navigate to="/pricing" replace />;

  return <BattleInner />;
}

function BattleInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("lobby");
  const [duration, setDuration] = useState<Duration>(25);
  const [mode, setMode] = useState<Mode>("bot");
  const [roomCode, setRoomCode] = useState("");
  const [opponent, setOpponent] = useState<string>("Focus Bot");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  // Arena
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [opponentProgress, setOpponentProgress] = useState(0); // 0..1
  const [trash, setTrash] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [xp, setXp] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const quitRef = useRef(false);
  const lastPushRef = useRef(0);

  // Realtime subscription to the current battle_rooms row
  useEffect(() => {
    if (!roomId || mode !== "room") return;
    const channel = supabase
      .channel(`battle_room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battle_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const row: any = payload.new;
          if (isHost) {
            if (row.guest_name) setOpponent(row.guest_name);
            setOpponentProgress(Number(row.guest_progress) || 0);
          } else {
            if (row.host_name) setOpponent(row.host_name);
            setOpponentProgress(Number(row.host_progress) || 0);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, isHost, mode]);

  // Push my progress upstream while in the arena (room mode only)
  useEffect(() => {
    if (phase !== "arena" || mode !== "room" || !roomId) return;
    const now = Date.now();
    if (now - lastPushRef.current < 400) return;
    lastPushRef.current = now;
    const myProgress = total ? 1 - secondsLeft / total : 0;
    const patch = isHost
      ? { host_progress: myProgress }
      : { guest_progress: myProgress };
    (supabase as any).from("battle_rooms").update(patch).eq("id", roomId).then(() => {});
  }, [secondsLeft, phase, mode, roomId, isHost, duration]);

  const total = duration * 60;
  const userProgress = total ? 1 - secondsLeft / total : 0;

  // Countdown 3-2-1
  useEffect(() => {
    if (phase !== "countdown") return;
    setCountdown(3);
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        setSecondsLeft(total);
        setOpponentProgress(0);
        quitRef.current = false;
        setPhase("arena");
      } else {
        setCountdown(n);
      }
    }, 900);
    return () => clearInterval(id);
  }, [phase, total]);

  // Arena tick — user timer + opponent progress + battle text
  useEffect(() => {
    if (phase !== "arena") return;
    const start = Date.now();
    // Opponent's secret pace: slightly variable around a finish slightly slower/faster than user
    const opponentTotalMs = total * 1000 * (0.92 + Math.random() * 0.2);
    let lastTrash = 0;

    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, total - Math.floor(elapsed / 1000));
      setSecondsLeft(left);
      if (mode !== "room") {
        const op = Math.min(1, elapsed / opponentTotalMs);
        setOpponentProgress(op);
        if (op >= 1) {
          clearInterval(id);
          finish("loss");
          return;
        }
      }

      // Trash talk every ~12s
      if (Date.now() - lastTrash > 12000 && left > 4) {
        lastTrash = Date.now();
        const lines = [
          `${opponent} is gaining momentum!`,
          `${opponent} just hit a deep focus streak.`,
          "Don't break — they're catching up!",
          `${opponent} looks rattled. Push harder!`,
          "You're in the zone. Keep going.",
          `${opponent} took a micro-break. Capitalize!`,
        ];
        setTrash(lines[Math.floor(Math.random() * lines.length)]);
        setTimeout(() => setTrash(null), 3500);
      }

      // Win by finishing the timer
      if (left <= 0) {
        clearInterval(id);
        finish("win");
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Room mode: loss when live opponent progress hits 1
  useEffect(() => {
    if (phase !== "arena" || mode !== "room") return;
    if (opponentProgress >= 1) finish("loss");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponentProgress, phase, mode]);


  const finish = async (result: Outcome) => {
    if (quitRef.current) return;
    setOutcome(result);
    setPhase("result");
    const earned = result === "win" ? duration * 10 : Math.floor(duration * 3);
    setXp(earned);

    // Only log a study session on win — fairness for the leaderboard
    if (result === "win" && user) {
      const { error } = await supabase.from("study_sessions").insert({
        user_id: user.id,
        duration_minutes: duration,
        completed_at: new Date().toISOString(),
      });
      if (error) toast.error("Couldn't save session: " + error.message);
      else toast.success(`Victory! +${duration}m logged to leaderboard.`);
    }
  };

  const startBattle = () => {
    if (mode === "bot") {
      setOpponent(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]);
      setRoomId(null);
      setIsHost(false);
    } else if (!roomId) {
      toast.error("Generate or join a room first");
      return;
    }
    setPhase("countdown");
  };

  const generateRoomCode = async () => {
    if (!user) return;
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const hostName =
      (user.user_metadata?.display_name as string) ||
      (user.email?.split("@")[0] ?? "Host");
    const { data, error } = await (supabase as any)
      .from("battle_rooms")
      .insert({
        code,
        host_user_id: user.id,
        host_name: hostName,
        duration_minutes: duration,
      })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("Couldn't create room: " + (error?.message ?? "unknown"));
      return;
    }
    setRoomCode(code);
    setRoomId(data.id);
    setIsHost(true);
    setOpponent("Waiting for opponent…");
    toast.success(`Room ${code} created — share to invite.`);
  };

  const copyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    toast.success("Room code copied");
  };

  const surrender = () => {
    quitRef.current = true;
    setOutcome(null);
    setSecondsLeft(0);
    setOpponentProgress(0);
    setTrash(null);
    setOpponent("Focus Bot");
    setRoomId(null);
    setIsHost(false);
    setPhase("lobby");
    toast("Match abandoned");
    navigate("/battle", { replace: true });
  };

  const joinRoom = async () => {
    if (!user) return;
    const code = roomCode.trim().toUpperCase();
    if (code.length < 4) {
      toast.error("Enter a valid room code");
      return;
    }
    const { data, error } = await (supabase as any)
      .from("battle_rooms")
      .select("id, host_name, host_user_id, duration_minutes")
      .eq("code", code)
      .maybeSingle();
    if (error || !data) {
      toast.error("Room not found. Check the code and try again.");
      return;
    }
    if (data.host_user_id === user.id) {
      toast.error("You can't join your own room — share the code with a friend.");
      return;
    }
    const guestName =
      (user.user_metadata?.display_name as string) ||
      (user.email?.split("@")[0] ?? "Guest");
    const { error: updErr } = await (supabase as any)
      .from("battle_rooms")
      .update({
        guest_user_id: user.id,
        guest_name: guestName,
        guest_progress: 0,
        status: "active",
      })
      .eq("id", data.id);
    if (updErr) {
      toast.error("Couldn't join room: " + updErr.message);
      return;
    }
    if (data.duration_minutes && [15, 25, 45].includes(data.duration_minutes)) {
      setDuration(data.duration_minutes as Duration);
    }
    setRoomId(data.id);
    setIsHost(false);
    setOpponent(data.host_name || `Player ${code.slice(-3)}`);
    toast.success(`Joined ${data.host_name}'s room!`);
    setPhase("countdown");
  };

  const resetToLobby = () => {
    quitRef.current = true;
    setOutcome(null);
    setSecondsLeft(0);
    setOpponentProgress(0);
    setPhase("lobby");
  };

  // ---------- RENDER ----------

  if (phase === "lobby") {
    return (
      <Lobby
        duration={duration}
        setDuration={setDuration}
        mode={mode}
        setMode={setMode}
        roomCode={roomCode}
        setRoomCode={setRoomCode}
        generateRoomCode={generateRoomCode}
        copyCode={copyCode}
        joinRoom={joinRoom}
        onStart={startBattle}
      />
    );
  }

  if (phase === "countdown") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-6">
          Battle starts in
        </div>
        <div
          key={countdown}
          className="text-[160px] leading-none font-black text-gradient animate-scale-in"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {countdown}
        </div>
        <div className="mt-8 text-muted-foreground">vs {opponent}</div>
      </div>
    );
  }

  if (phase === "arena") {
    return (
      <Arena
        opponent={opponent}
        secondsLeft={secondsLeft}
        userProgress={userProgress}
        opponentProgress={opponentProgress}
        trash={trash}
        onSurrender={surrender}
      />
    );
  }

  // Result
  return (
    <ResultScreen
      outcome={outcome!}
      xp={xp}
      duration={duration}
      opponent={opponent}
      onPlayAgain={resetToLobby}
      onLeaderboard={() => navigate("/leaderboard")}
    />
  );
}

// ---------------- LOBBY ----------------

function Lobby({
  duration,
  setDuration,
  mode,
  setMode,
  roomCode,
  setRoomCode,
  generateRoomCode,
  copyCode,
  joinRoom,
  onStart,
}: {
  duration: Duration;
  setDuration: (d: Duration) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  roomCode: string;
  setRoomCode: (v: string) => void;
  generateRoomCode: () => void;
  copyCode: () => void;
  joinRoom: () => void;
  onStart: () => void;
}) {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs uppercase tracking-wider">
          <Swords className="w-3 h-3" /> Focus Duel
        </div>
        <h1 className="text-4xl font-bold">Choose your battle</h1>
        <p className="text-muted-foreground">
          Lock in a duration, pick your opponent, and out-focus them.
        </p>
      </div>

      {/* Duration */}
      <Card className="p-6 bg-gradient-card border-border">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
          Battle duration
        </div>
        <div className="grid grid-cols-3 gap-3">
          {([15, 25, 45] as Duration[]).map((d) => {
            const active = duration === d;
            return (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`relative rounded-2xl p-5 text-left transition-all border ${
                  active
                    ? "border-primary bg-primary/10 shadow-glow"
                    : "border-border bg-secondary/40 hover:border-primary/40"
                }`}
              >
                <div className="text-3xl font-bold tabular-nums">{d}m</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {d === 15 ? "Sprint" : d === 25 ? "Standard" : "Marathon"}
                </div>
                {active && (
                  <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary shadow-glow" />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Opponent */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card
          onClick={() => setMode("bot")}
          className={`p-6 cursor-pointer transition-all border ${
            mode === "bot"
              ? "border-primary bg-primary/5 shadow-glow"
              : "border-border bg-gradient-card hover:border-primary/40"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <Bot className="w-6 h-6 text-primary-foreground" />
            </div>
            {mode === "bot" && (
              <Check className="w-5 h-5 text-primary" />
            )}
          </div>
          <h3 className="text-lg font-semibold mb-1">Focus Bot</h3>
          <p className="text-sm text-muted-foreground">
            Instant matchup against an AI rival with adaptive pacing.
          </p>
        </Card>

        <Card
          onClick={() => setMode("room")}
          className={`p-6 cursor-pointer transition-all border ${
            mode === "room"
              ? "border-accent bg-accent/5"
              : "border-border bg-gradient-card hover:border-accent/40"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center">
              <Users className="w-6 h-6 text-accent-foreground" />
            </div>
            {mode === "room" && <Check className="w-5 h-5 text-accent" />}
          </div>
          <h3 className="text-lg font-semibold mb-1">Room Code</h3>
          <p className="text-sm text-muted-foreground">
            Create a private room and challenge a friend.
          </p>

          {mode === "room" && (
            <div className="mt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <Input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="ENTER OR GENERATE CODE"
                  className="font-mono tracking-[0.3em] uppercase text-center"
                />
                <Button variant="secondary" size="icon" onClick={copyCode} disabled={!roomCode}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={generateRoomCode}>
                  Generate
                </Button>
                <Button variant="default" onClick={joinRoom} disabled={roomCode.length < 4}>
                  <Users className="w-4 h-4 mr-1" /> Join Room
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Paste a friend's code and hit Join, or Generate one to share.
              </p>
            </div>
          )}
        </Card>
      </div>

      <Button size="lg" className="w-full h-14 text-base shadow-glow" onClick={onStart}>
        <Swords className="w-5 h-5 mr-2" />
        Enter the arena
      </Button>
    </div>
  );
}

// ---------------- ARENA ----------------

function Arena({
  opponent,
  secondsLeft,
  userProgress,
  opponentProgress,
  trash,
  onSurrender,
}: {
  opponent: string;
  secondsLeft: number;
  userProgress: number;
  opponentProgress: number;
  trash: string | null;
  onSurrender: () => void;
}) {
  const { user } = useAuth();
  const userName =
    (user?.user_metadata?.display_name as string) ||
    (user?.email?.split("@")[0] ?? "You");

  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");

  const leading =
    userProgress > opponentProgress ? "user" : userProgress < opponentProgress ? "opp" : "tie";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onSurrender}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Surrender
        </Button>
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Focus Duel · Live
        </div>
        <div className="w-24" />
      </div>

      {/* Trash talk overlay */}
      <div className="h-6 flex items-center justify-center">
        {trash && (
          <div className="px-4 py-1 rounded-full bg-accent/15 border border-accent/40 text-accent text-xs animate-fade-in flex items-center gap-2">
            <Flame className="w-3 h-3" />
            {trash}
          </div>
        )}
      </div>

      {/* Split arena */}
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
        <Fighter
          name={userName}
          accent="primary"
          progress={userProgress}
          isLeading={leading === "user"}
          big={
            <div className="font-black tabular-nums text-7xl md:text-8xl text-gradient leading-none">
              {mm}:{ss}
            </div>
          }
          subtitle="Your focus timer"
          icon={<Zap className="w-5 h-5" />}
        />

        <div className="flex md:flex-col items-center justify-center gap-2 px-2">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">vs</div>
          <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center">
            <Swords className="w-5 h-5 text-accent" />
          </div>
        </div>

        <Fighter
          name={opponent}
          accent="accent"
          progress={opponentProgress}
          isLeading={leading === "opp"}
          big={
            <div className="font-black tabular-nums text-7xl md:text-8xl leading-none text-accent">
              {Math.round(opponentProgress * 100)}%
            </div>
          }
          subtitle="Opponent progress"
          icon={<Bot className="w-5 h-5" />}
        />
      </div>
    </div>
  );
}

function Fighter({
  name,
  accent,
  progress,
  isLeading,
  big,
  subtitle,
  icon,
}: {
  name: string;
  accent: "primary" | "accent";
  progress: number;
  isLeading: boolean;
  big: React.ReactNode;
  subtitle: string;
  icon: React.ReactNode;
}) {
  const ring = accent === "primary" ? "ring-primary/40" : "ring-accent/40";
  const grad = accent === "primary" ? "gradient-primary" : "gradient-accent";
  return (
    <Card
      className={`relative p-6 bg-gradient-card border-border overflow-hidden ${
        isLeading ? `ring-2 ${ring} shadow-glow` : ""
      }`}
    >
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: "var(--gradient-hero)" }} />
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${grad} flex items-center justify-center shadow-glow`}>
            <span className="text-primary-foreground">{icon}</span>
          </div>
          <div>
            <div className="font-semibold">{name}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {subtitle}
            </div>
          </div>
        </div>
        {isLeading && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-warning/15 text-warning text-[10px] uppercase tracking-wider">
            <Crown className="w-3 h-3" /> Leading
          </div>
        )}
      </div>

      <div className="relative flex items-center justify-center py-8 min-h-[180px]">
        {big}
      </div>

      <div className="relative">
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full ${grad} shadow-glow transition-all duration-300`}
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Progress</span>
          <span className="tabular-nums">{Math.round(progress * 100)}%</span>
        </div>
      </div>
    </Card>
  );
}

// ---------------- RESULT ----------------

function ResultScreen({
  outcome,
  xp,
  duration,
  opponent,
  onPlayAgain,
  onLeaderboard,
}: {
  outcome: Outcome;
  xp: number;
  duration: number;
  opponent: string;
  onPlayAgain: () => void;
  onLeaderboard: () => void;
}) {
  const win = outcome === "win";
  return (
    <div className="max-w-xl mx-auto">
      <Card className="relative p-10 text-center bg-gradient-card border-border overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="relative">
          <div
            className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-glow ${
              win ? "gradient-primary" : "bg-secondary border border-border"
            }`}
          >
            {win ? (
              <Trophy className="w-10 h-10 text-primary-foreground" />
            ) : (
              <Skull className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">
            {win ? "Victory" : "Defeat"}
          </div>
          <h2 className="text-4xl font-bold mb-2">
            {win ? "You out-focused them" : `${opponent} took this one`}
          </h2>
          <p className="text-muted-foreground mb-8">
            {win
              ? `+${duration} minutes added to your weekly leaderboard total.`
              : "Shake it off — your next round is one click away."}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="rounded-xl bg-secondary/50 p-4">
              <div className="text-3xl font-bold tabular-nums flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                {xp}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                XP earned
              </div>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4">
              <div className="text-3xl font-bold tabular-nums">
                {win ? duration : 0}m
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                Logged to leaderboard
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button variant="secondary" onClick={onLeaderboard}>
              <Trophy className="w-4 h-4 mr-1" /> Leaderboard
            </Button>
            <Button onClick={onPlayAgain}>
              <Swords className="w-4 h-4 mr-1" /> Battle again
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
