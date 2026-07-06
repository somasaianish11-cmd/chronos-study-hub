import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Layers,
  Plus,
  Trash2,
  ArrowLeft,
  Play,
  RotateCcw,
  Sparkles,
  BookOpen,
  Brain,
  Lightbulb,
  Rocket,
  Atom,
  Globe,
  Calculator,
  Beaker,
  Music,
  Palette,
  Code,
  Heart,
  Volume2,
  Wand2,
  Loader2,
} from "lucide-react";

import { toast } from "sonner";
import UpgradeModal from "@/components/UpgradeModal";

type Deck = {
  id: string;
  name: string;
  description: string | null;
};

type Flashcard = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  ease_score: number | null;
  interval_days?: number | null;
  repetitions?: number | null;
  next_review_date?: string | null;
};

// --- Text to speech helper ---
const speak = (text: string) => {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  } catch {}
};

// --- SM-2-lite spaced repetition ---
type Grade = "again" | "hard" | "good" | "easy";
const GRADE_META: Record<Grade, { label: string; color: string; key: string }> = {
  again: { label: "Again", color: "rose", key: "1" },
  hard: { label: "Hard", color: "orange", key: "2" },
  good: { label: "Good", color: "emerald", key: "3" },
  easy: { label: "Easy", color: "sky", key: "4" },
};

function schedule(card: Flashcard, grade: Grade) {
  let ease = Math.max(1.3, (card.ease_score ?? 2.5));
  let reps = card.repetitions ?? 0;
  let interval = Number(card.interval_days ?? 0);

  if (grade === "again") {
    reps = 0;
    interval = 0; // review today
    ease = Math.max(1.3, ease - 0.2);
  } else {
    if (reps === 0) interval = grade === "easy" ? 4 : grade === "good" ? 1 : 0.5;
    else if (reps === 1) interval = grade === "easy" ? 7 : grade === "good" ? 3 : 1;
    else interval = Math.round(interval * (grade === "easy" ? ease + 0.3 : grade === "good" ? ease : 1.2));
    reps += 1;
    if (grade === "hard") ease = Math.max(1.3, ease - 0.15);
    if (grade === "easy") ease = ease + 0.15;
  }
  const nextDate = new Date(Date.now() + interval * 86400000).toISOString();
  return { ease_score: Number(ease.toFixed(2)), repetitions: reps, interval_days: interval, next_review_date: nextDate };
}


// Curated gradient + icon palette for decks (deterministic by id)
const DECK_THEMES = [
  { gradient: "from-violet-500 to-fuchsia-500", icon: Brain },
  { gradient: "from-sky-500 to-blue-600", icon: Globe },
  { gradient: "from-emerald-500 to-teal-500", icon: Beaker },
  { gradient: "from-amber-500 to-orange-600", icon: Lightbulb },
  { gradient: "from-rose-500 to-pink-600", icon: Heart },
  { gradient: "from-indigo-500 to-purple-600", icon: Atom },
  { gradient: "from-cyan-500 to-blue-500", icon: Code },
  { gradient: "from-orange-500 to-red-500", icon: Rocket },
  { gradient: "from-lime-500 to-emerald-500", icon: Calculator },
  { gradient: "from-pink-500 to-rose-500", icon: Music },
  { gradient: "from-purple-500 to-indigo-500", icon: Palette },
  { gradient: "from-teal-500 to-cyan-500", icon: BookOpen },
];

const themeFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return DECK_THEMES[h % DECK_THEMES.length];
};

export default function Flashcards() {
  const { user, isPro } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [studyDeck, setStudyDeck] = useState<Deck | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [showDeck, setShowDeck] = useState(false);
  const [deckForm, setDeckForm] = useState({ name: "", description: "" });

  const loadDecks = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("flashcard_decks")
      .select("id, name, description")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setDecks((data as Deck[]) || []);

    const { data: cards } = await supabase
      .from("flashcards")
      .select("deck_id")
      .eq("user_id", user.id);
    const c: Record<string, number> = {};
    (cards || []).forEach((r: any) => {
      c[r.deck_id] = (c[r.deck_id] || 0) + 1;
    });
    setCounts(c);
  };

  useEffect(() => {
    loadDecks();
  }, [user]);

  const createDeck = async () => {
    if (!user || !deckForm.name.trim()) return;
    const FREE_DECK_LIMIT = 3;
    if (!isPro && decks.length >= FREE_DECK_LIMIT) {
      setShowUpgrade(true);
      return;
    }
    const { error } = await supabase.from("flashcard_decks").insert({
      user_id: user.id,
      name: deckForm.name.trim(),
      description: deckForm.description.trim() || null,
    });
    if (error) return toast.error(error.message);
    setDeckForm({ name: "", description: "" });
    setShowDeck(false);
    loadDecks();
  };

  const deleteDeck = async (id: string) => {
    const { error } = await supabase.from("flashcard_decks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadDecks();
  };

  if (studyDeck) {
    return (
      <StudyMode
        deck={studyDeck}
        onExit={() => {
          setStudyDeck(null);
          loadDecks();
        }}
      />
    );
  }

  if (activeDeck) {
    return (
      <DeckDetail
        deck={activeDeck}
        onBack={() => {
          setActiveDeck(null);
          loadDecks();
        }}
        onStudy={() => setStudyDeck(activeDeck)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Flashcards</h1>
          <p className="text-muted-foreground">
            {!isPro && (
              <span className="text-accent">{decks.length}/3 decks (free)</span>
            )}
            {isPro && "Create decks and study with active recall."}
          </p>
        </div>
        <Dialog open={showDeck} onOpenChange={setShowDeck}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-1" />
              New deck
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New deck</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={deckForm.name}
                  onChange={(e) =>
                    setDeckForm({ ...deckForm, name: e.target.value })
                  }
                  placeholder="Biology — Cell structure"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={deckForm.description}
                  onChange={(e) =>
                    setDeckForm({ ...deckForm, description: e.target.value })
                  }
                  rows={2}
                  placeholder="Optional"
                />
              </div>
              <Button onClick={createDeck} className="w-full">
                Create deck
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {decks.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card border-border">
          <Layers className="w-12 h-12 text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            No decks yet — create your first one to get started.
          </p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {decks.map((d) => {
            const { gradient, icon: Icon } = themeFor(d.id);
            const count = counts[d.id] || 0;
            return (
              <Card
                key={d.id}
                onClick={() => setActiveDeck(d)}
                className="group relative overflow-hidden p-0 bg-gradient-card border-border hover:border-primary/50 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-elevated"
              >
                {/* Color band */}
                <div className={`relative h-24 bg-gradient-to-br ${gradient} overflow-hidden`}>
                  <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
                  <div className="absolute -left-4 -bottom-8 w-28 h-28 rounded-full bg-black/20 blur-2xl" />
                  <div className="absolute inset-0 flex items-center justify-between px-5">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center ring-1 ring-white/30">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white tabular-nums leading-none">
                        {count}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-white/80 mt-1">
                        {count === 1 ? "card" : "cards"}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 text-white hover:bg-white/20 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDeck(d.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="p-5">
                  <h3 className="font-semibold mb-1 truncate">{d.name}</h3>
                  {d.description ? (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {d.description}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Tap to open deck
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <UpgradeModal
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        feature="More than 3 flashcard decks"
      />
    </div>
  );
}

function DeckDetail({
  deck,
  onBack,
  onStudy,
}: {
  deck: Deck;
  onBack: () => void;
  onStudy: () => void;
}) {
  const { user } = useAuth();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ front: "", back: "" });
  const [showAI, setShowAI] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiLoading, setAiLoading] = useState(false);


  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("flashcards")
      .select("id, deck_id, front, back, ease_score")
      .eq("deck_id", deck.id)
      .order("created_at", { ascending: false });
    setCards((data as Flashcard[]) || []);
  };

  useEffect(() => {
    load();
  }, [deck.id]);

  const addCard = async () => {
    if (!user || !form.front.trim() || !form.back.trim()) return;
    const { error } = await supabase.from("flashcards").insert({
      user_id: user.id,
      deck_id: deck.id,
      front: form.front.trim(),
      back: form.back.trim(),
    });
    if (error) return toast.error(error.message);
    setForm({ front: "", back: "" });
    setShow(false);
    load();
  };

  const delCard = async (id: string) => {
    const { error } = await supabase.from("flashcards").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const generateWithAI = async () => {
    if (!user || !aiTopic.trim()) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-flashcards", {
        body: { topic: aiTopic.trim(), count: 5 },
      });
      if (error) throw error;
      const generated = (data?.cards || []) as { front: string; back: string }[];
      if (generated.length === 0) throw new Error("No cards generated");
      const rows = generated.map((c) => ({
        user_id: user.id,
        deck_id: deck.id,
        front: c.front,
        back: c.back,
      }));
      const { error: insErr } = await supabase.from("flashcards").insert(rows);
      if (insErr) throw insErr;
      toast.success(`Added ${generated.length} AI-generated cards`);
      setAiTopic("");
      setShowAI(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  const { gradient, icon: Icon } = themeFor(deck.id);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-glow`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{deck.name}</h1>
            {deck.description && (
              <p className="text-sm text-muted-foreground">{deck.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={onStudy}
            disabled={cards.length === 0}
          >
            <Play className="w-4 h-4 mr-1" />
            Study ({cards.length})
          </Button>
          <Dialog open={showAI} onOpenChange={setShowAI}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
                <Wand2 className="w-4 h-4 mr-1" />
                AI generate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Generate 5 flashcards with AI
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Sub-topic or study text</Label>
                  <Textarea
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    rows={5}
                    placeholder="e.g. Krebs cycle, or paste a passage from your notes…"
                  />
                </div>
                <Button onClick={generateWithAI} disabled={aiLoading || !aiTopic.trim()} className="w-full">
                  {aiLoading ? (
                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating…</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-1" /> Generate 5 cards</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={show} onOpenChange={setShow}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-1" />
                Add card
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New flashcard</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Front (term)</Label>
                  <Textarea
                    value={form.front}
                    onChange={(e) =>
                      setForm({ ...form, front: e.target.value })
                    }
                    rows={3}
                    placeholder="What is mitosis?"
                  />
                </div>
                <div>
                  <Label>Back (definition)</Label>
                  <Textarea
                    value={form.back}
                    onChange={(e) =>
                      setForm({ ...form, back: e.target.value })
                    }
                    rows={3}
                    placeholder="The process by which a cell divides..."
                  />
                </div>
                <Button onClick={addCard} className="w-full">
                  Add card
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-5 bg-gradient-card border-border">
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No cards yet — add your first one above.
          </p>
        ) : (
          <div className="space-y-2">
            {cards.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[1fr_1fr_auto] gap-3 p-3 rounded-lg bg-secondary/40 items-start"
              >
                <div className="text-sm whitespace-pre-wrap">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Term
                  </div>
                  {c.front}
                </div>
                <div className="text-sm whitespace-pre-wrap">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Definition
                  </div>
                  {c.back}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => delCard(c.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StudyMode({ deck, onExit }: { deck: Deck; onExit: () => void }) {
  const { user } = useAuth();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [done, setDone] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);

  const [swipe, setSwipe] = useState<null | "left" | "right">(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("flashcards")
        .select("id, deck_id, front, back, ease_score, interval_days, repetitions, next_review_date")
        .eq("deck_id", deck.id);
      const shuffled = [...((data as Flashcard[]) || [])].sort(() => Math.random() - 0.5);
      setCards(shuffled);
    })();
    return () => { try { window.speechSynthesis?.cancel(); } catch {} };
  }, [deck.id, user]);

  const current = cards[index];

  // Auto-speak when TTS on
  useEffect(() => {
    if (!current || !ttsOn) return;
    speak(flipped ? current.back : current.front);
  }, [current, flipped, ttsOn]);

  const grade = useCallback(
    async (g: Grade) => {
      if (!current || swipe) return;
      const sched = schedule(current, g);
      setSwipe(g === "again" || g === "hard" ? "left" : "right");

      supabase
        .from("flashcards")
        .update({ ...sched, last_reviewed_at: new Date().toISOString() })
        .eq("id", current.id)
        .then(() => {});

      setTimeout(() => {
        setStats((s) => ({ ...s, [g]: (s as any)[g] + 1 }));
        if (index + 1 >= cards.length) setDone(true);
        else { setIndex(index + 1); setFlipped(false); }
        setSwipe(null);
        setDragX(0);
      }, 260);
    },
    [current, index, cards.length, swipe]
  );

  // Keyboard: space flip, 1/2/3/4 grade, S toggles speech
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); return; }
      if (e.key.toLowerCase() === "s") { setTtsOn((v) => !v); return; }
      if (!flipped) { if (["1","2","3","4","ArrowLeft","ArrowRight"].includes(e.key)) setFlipped(true); return; }
      if (e.key === "1" || e.key === "ArrowLeft") { e.preventDefault(); grade("again"); }
      else if (e.key === "2") { e.preventDefault(); grade("hard"); }
      else if (e.key === "3" || e.key === "ArrowRight") { e.preventDefault(); grade("good"); }
      else if (e.key === "4") { e.preventDefault(); grade("easy"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, grade, done]);

  const restart = () => {
    setCards((c) => [...c].sort(() => Math.random() - 0.5));
    setIndex(0);
    setFlipped(false);
    setStats({ again: 0, hard: 0, good: 0, easy: 0 });
    setDone(false);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!flipped) return;
    setDragging(true);
    setStartX(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragX(e.clientX - startX);
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const threshold = 120;
    if (dragX > threshold) grade("good");
    else if (dragX < -threshold) grade("again");
    else setDragX(0);
  };


  if (cards.length === 0) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onExit}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Card className="p-12 text-center bg-gradient-card border-border">
          <p className="text-muted-foreground">Loading…</p>
        </Card>
      </div>
    );
  }

  if (done) {
    const total = stats.again + stats.hard + stats.good + stats.easy;
    const correct = stats.good + stats.easy;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Card className="p-10 text-center bg-gradient-card border-border overflow-hidden relative">
          <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: "var(--gradient-hero)" }} />
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-5 shadow-glow">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>
            <h2 className="text-3xl font-bold mb-1">Session complete</h2>
            <p className="text-muted-foreground mb-8">Nice work on {deck.name}.</p>

            <div className="grid grid-cols-5 gap-2 mb-8">
              <div className="rounded-xl bg-secondary/50 p-3">
                <div className="text-2xl font-bold tabular-nums">{pct}%</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">Accuracy</div>
              </div>
              <div className="rounded-xl bg-rose-500/10 ring-1 ring-rose-500/30 p-3">
                <div className="text-2xl font-bold tabular-nums text-rose-400">{stats.again}</div>
                <div className="text-[9px] uppercase tracking-wider text-rose-400/80 mt-1">Again</div>
              </div>
              <div className="rounded-xl bg-orange-500/10 ring-1 ring-orange-500/30 p-3">
                <div className="text-2xl font-bold tabular-nums text-orange-400">{stats.hard}</div>
                <div className="text-[9px] uppercase tracking-wider text-orange-400/80 mt-1">Hard</div>
              </div>
              <div className="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30 p-3">
                <div className="text-2xl font-bold tabular-nums text-emerald-400">{stats.good}</div>
                <div className="text-[9px] uppercase tracking-wider text-emerald-400/80 mt-1">Good</div>
              </div>
              <div className="rounded-xl bg-sky-500/10 ring-1 ring-sky-500/30 p-3">
                <div className="text-2xl font-bold tabular-nums text-sky-400">{stats.easy}</div>
                <div className="text-[9px] uppercase tracking-wider text-sky-400/80 mt-1">Easy</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button variant="secondary" onClick={onExit}>Back to deck</Button>
              <Button onClick={restart}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Restart deck
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }


  // Compute drag visuals
  const rotate = dragX / 18;
  const correctOpacity = Math.min(1, Math.max(0, dragX / 140));
  const incorrectOpacity = Math.min(1, Math.max(0, -dragX / 140));

  // Swipe-off transform
  const swipeTransform =
    swipe === "right"
      ? "translateX(140%) rotate(20deg)"
      : swipe === "left"
      ? "translateX(-140%) rotate(-20deg)"
      : `translateX(${dragX}px) rotate(${rotate}deg)`;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" onClick={onExit}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Exit
        </Button>
        <div className="text-sm text-muted-foreground tabular-nums flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTtsOn((v) => !v)}
            title="Toggle read aloud (S)"
            className={ttsOn ? "text-primary" : ""}
          >
            <Volume2 className="w-4 h-4" />
          </Button>
          <span className="font-medium text-foreground">
            {index + 1} <span className="text-muted-foreground">/ {cards.length}</span>
          </span>
          <span className="text-emerald-400">✓ {stats.good + stats.easy}</span>
          <span className="text-rose-400">✗ {stats.again + stats.hard}</span>
        </div>
      </div>


      {/* Progress bar */}
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full gradient-primary transition-all duration-500 ease-out shadow-glow"
          style={{ width: `${(index / cards.length) * 100}%` }}
        />
      </div>

      {/* Flashcard with 3D flip */}
      <div className="relative" style={{ perspective: "1600px" }}>
        {/* Background stacked cards for depth */}
        <div className="absolute inset-x-6 top-3 h-[340px] rounded-3xl bg-card/60 border border-border/60 -z-10 scale-[0.96]" />
        <div className="absolute inset-x-10 top-6 h-[340px] rounded-3xl bg-card/40 border border-border/40 -z-20 scale-[0.92]" />

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={() => !dragging && Math.abs(dragX) < 4 && setFlipped((f) => !f)}
          className="relative select-none touch-none cursor-pointer"
          style={{
            transform: swipeTransform,
            transition: dragging ? "none" : "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          {/* Correct/Incorrect overlay badges */}
          <div
            className="pointer-events-none absolute top-6 left-6 z-20 px-4 py-2 rounded-xl border-2 border-emerald-400 text-emerald-400 font-bold tracking-wider text-sm -rotate-12"
            style={{ opacity: correctOpacity }}
          >
            CORRECT
          </div>
          <div
            className="pointer-events-none absolute top-6 right-6 z-20 px-4 py-2 rounded-xl border-2 border-rose-400 text-rose-400 font-bold tracking-wider text-sm rotate-12"
            style={{ opacity: incorrectOpacity }}
          >
            REVIEW
          </div>

          <div
            className="relative w-full h-[360px]"
            style={{
              transformStyle: "preserve-3d",
              transition: "transform 600ms cubic-bezier(0.32, 0.72, 0, 1)",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* Front */}
            <Card
              className="absolute inset-0 p-10 flex flex-col items-center justify-center text-center bg-gradient-card border-border shadow-card rounded-3xl"
              style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-6">
                Term
              </div>
              <div className="text-2xl md:text-3xl font-semibold whitespace-pre-wrap max-w-2xl leading-snug">
                {current.front}
              </div>
              <div className="absolute bottom-5 text-xs text-muted-foreground">
                Tap card or press Space to flip
              </div>
            </Card>

            {/* Back */}
            <Card
              className="absolute inset-0 p-10 flex flex-col items-center justify-center text-center border-border shadow-elevated rounded-3xl"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                background:
                  "linear-gradient(140deg, hsl(247 60% 16%) 0%, hsl(240 10% 9%) 60%)",
              }}
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-primary-glow mb-6">
                Definition
              </div>
              <div className="text-xl md:text-2xl font-medium whitespace-pre-wrap max-w-2xl leading-relaxed">
                {current.back}
              </div>
              <div className="absolute bottom-5 text-xs text-muted-foreground">
                Swipe or use ← →
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Controls */}
      {/* SRS Controls */}
      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          <Button
            size="lg"
            variant="outline"
            onClick={() => grade("again")}
            disabled={!!swipe}
            className="h-16 flex-col border-rose-500/40 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/60"
          >
            <span className="font-semibold">Again</span>
            <span className="text-[10px] opacity-70">&lt; 10m · 1</span>
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => grade("hard")}
            disabled={!!swipe}
            className="h-16 flex-col border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 hover:border-orange-500/60"
          >
            <span className="font-semibold">Hard</span>
            <span className="text-[10px] opacity-70">soon · 2</span>
          </Button>
          <Button
            size="lg"
            onClick={() => grade("good")}
            disabled={!!swipe}
            className="h-16 flex-col bg-emerald-500 hover:bg-emerald-600 text-white shadow-glow"
          >
            <span className="font-semibold">Good</span>
            <span className="text-[10px] opacity-80">1-3d · 3</span>
          </Button>
          <Button
            size="lg"
            onClick={() => grade("easy")}
            disabled={!!swipe}
            className="h-16 flex-col bg-sky-500 hover:bg-sky-600 text-white shadow-glow"
          >
            <span className="font-semibold">Easy</span>
            <span className="text-[10px] opacity-80">4-7d · 4</span>
          </Button>
        </div>
      ) : (
        <div className="flex justify-center">
          <Button size="lg" onClick={() => setFlipped(true)} className="h-14 px-10 shadow-glow">
            Show answer <kbd className="ml-3 text-[10px] px-1.5 py-0.5 rounded bg-white/15 border border-white/20">Space</kbd>
          </Button>
        </div>
      )}
    </div>

  );
}
