import { useEffect, useState } from "react";
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
  Check,
  X,
  RotateCcw,
  Sparkles,
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((d) => (
            <Card
              key={d.id}
              className="p-5 bg-gradient-card border-border hover:border-primary/40 transition-colors cursor-pointer group"
              onClick={() => setActiveDeck(d)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
                  <Layers className="w-5 h-5 text-primary-foreground" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDeck(d.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <h3 className="font-semibold mb-1 truncate">{d.name}</h3>
              {d.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {d.description}
                </p>
              )}
              <div className="text-xs text-muted-foreground">
                {counts[d.id] || 0} card{counts[d.id] === 1 ? "" : "s"}
              </div>
            </Card>
          ))}
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
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
                  <Label>Front (question)</Label>
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
                  <Label>Back (answer)</Label>
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
                    Front
                  </div>
                  {c.front}
                </div>
                <div className="text-sm whitespace-pre-wrap">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Back
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
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 });
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("flashcards")
        .select("id, deck_id, front, back, ease_score")
        .eq("deck_id", deck.id);
      const shuffled = [...((data as Flashcard[]) || [])].sort(
        () => Math.random() - 0.5
      );
      setCards(shuffled);
    })();
  }, [deck.id, user]);

  const current = cards[index];

  const mark = async (correct: boolean) => {
    if (!current) return;
    const newScore = Math.max(
      0,
      Math.min(10, (current.ease_score ?? 0) + (correct ? 1 : -1))
    );
    await supabase
      .from("flashcards")
      .update({
        ease_score: newScore,
        last_reviewed_at: new Date().toISOString(),
      })
      .eq("id", current.id);

    setStats((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      incorrect: s.incorrect + (correct ? 0 : 1),
    }));

    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(index + 1);
      setFlipped(false);
    }
  };

  const restart = () => {
    setCards((c) => [...c].sort(() => Math.random() - 0.5));
    setIndex(0);
    setFlipped(false);
    setStats({ correct: 0, incorrect: 0 });
    setDone(false);
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
    const total = stats.correct + stats.incorrect;
    const pct = total ? Math.round((stats.correct / total) * 100) : 0;
    return (
      <div className="space-y-6">
        <Card className="p-12 text-center bg-gradient-card border-border max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
            <Sparkles className="w-7 h-7 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Session complete</h2>
          <p className="text-muted-foreground mb-6">
            You got {stats.correct} of {total} correct ({pct}%).
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="secondary" onClick={onExit}>
              Back to deck
            </Button>
            <Button onClick={restart}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Study again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" onClick={onExit}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Exit
        </Button>
        <div className="text-sm text-muted-foreground tabular-nums">
          {index + 1} / {cards.length} · ✓ {stats.correct} · ✗ {stats.incorrect}
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full gradient-primary transition-all"
          style={{ width: `${((index + 1) / cards.length) * 100}%` }}
        />
      </div>

      <Card
        onClick={() => setFlipped((f) => !f)}
        className="p-12 min-h-[320px] flex flex-col items-center justify-center text-center bg-gradient-card border-border cursor-pointer select-none hover:border-primary/40 transition-colors"
      >
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-4">
          {flipped ? "Answer" : "Question"}
        </div>
        <div className="text-xl font-medium whitespace-pre-wrap max-w-2xl">
          {flipped ? current.back : current.front}
        </div>
        <div className="text-xs text-muted-foreground mt-6">
          Click card to {flipped ? "see question" : "reveal answer"}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button
          size="lg"
          variant="outline"
          onClick={() => mark(false)}
          disabled={!flipped}
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="w-5 h-5 mr-1" />
          Incorrect
        </Button>
        <Button
          size="lg"
          onClick={() => mark(true)}
          disabled={!flipped}
        >
          <Check className="w-5 h-5 mr-1" />
          Correct
        </Button>
      </div>
      {!flipped && (
        <p className="text-xs text-center text-muted-foreground">
          Flip the card before marking your answer.
        </p>
      )}
    </div>
  );
}
