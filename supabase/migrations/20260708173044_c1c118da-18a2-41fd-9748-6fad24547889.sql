DROP POLICY IF EXISTS "pro users insert decks" ON public.flashcard_decks;
DROP POLICY IF EXISTS "pro users update decks" ON public.flashcard_decks;

CREATE POLICY "users insert own decks" ON public.flashcard_decks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own decks" ON public.flashcard_decks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pro users insert flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "pro users update flashcards" ON public.flashcards;

CREATE POLICY "users insert own flashcards" ON public.flashcards
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own flashcards" ON public.flashcards
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);