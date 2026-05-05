
-- Flashcard decks
CREATE TABLE public.flashcard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own decks" ON public.flashcard_decks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Flashcards
CREATE TABLE public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  last_reviewed_at TIMESTAMPTZ,
  ease_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own flashcards" ON public.flashcards
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_flashcards_deck ON public.flashcards(deck_id);

-- Battles
CREATE TABLE public.battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL,
  opponent_id UUID,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 25,
  status TEXT NOT NULL DEFAULT 'pending',
  challenger_minutes INTEGER NOT NULL DEFAULT 0,
  opponent_minutes INTEGER NOT NULL DEFAULT 0,
  winner_id UUID,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants can view battles" ON public.battles
  FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE POLICY "challenger creates battles" ON public.battles
  FOR INSERT WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "participants update battles" ON public.battles
  FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE POLICY "challenger deletes battles" ON public.battles
  FOR DELETE USING (auth.uid() = challenger_id);

CREATE INDEX idx_battles_challenger ON public.battles(challenger_id);
CREATE INDEX idx_battles_opponent ON public.battles(opponent_id);
