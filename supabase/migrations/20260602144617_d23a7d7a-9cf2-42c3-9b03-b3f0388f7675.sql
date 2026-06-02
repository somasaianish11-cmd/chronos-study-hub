
-- 1. Restrict profiles SELECT (was: USING true exposing emails)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- 2. Restrict streaks SELECT
DROP POLICY IF EXISTS "streaks readable" ON public.streaks;

-- 3. Restrict study_sessions SELECT
DROP POLICY IF EXISTS "sessions readable for leaderboard" ON public.study_sessions;

-- 4. Pro check function
CREATE OR REPLACE FUNCTION public.is_pro(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = uid AND tier = 'pro' AND status = 'active'
  );
$$;

-- 5. Leaderboard view (aggregated, no emails). SECURITY DEFINER function approach.
CREATE OR REPLACE FUNCTION public.weekly_leaderboard()
RETURNS TABLE (user_id uuid, display_name text, total_minutes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id,
         COALESCE(p.display_name, 'Student') AS display_name,
         SUM(s.duration_minutes)::bigint AS total_minutes
  FROM public.study_sessions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE s.completed_at >= date_trunc('week', now())
  GROUP BY s.user_id, p.display_name
  ORDER BY total_minutes DESC
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.weekly_leaderboard() TO authenticated;

-- 6. Pro-gate flashcard_decks, flashcards, battles inserts/updates
DROP POLICY IF EXISTS "users manage own decks" ON public.flashcard_decks;
CREATE POLICY "users select own decks" ON public.flashcard_decks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pro users insert decks" ON public.flashcard_decks
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_pro(auth.uid()));
CREATE POLICY "pro users update decks" ON public.flashcard_decks
  FOR UPDATE USING (auth.uid() = user_id AND public.is_pro(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_pro(auth.uid()));
CREATE POLICY "users delete own decks" ON public.flashcard_decks
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users manage own flashcards" ON public.flashcards;
CREATE POLICY "users select own flashcards" ON public.flashcards
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pro users insert flashcards" ON public.flashcards
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_pro(auth.uid()));
CREATE POLICY "pro users update flashcards" ON public.flashcards
  FOR UPDATE USING (auth.uid() = user_id AND public.is_pro(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_pro(auth.uid()));
CREATE POLICY "users delete own flashcards" ON public.flashcards
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "challenger creates battles" ON public.battles;
CREATE POLICY "pro challenger creates battles" ON public.battles
  FOR INSERT WITH CHECK (auth.uid() = challenger_id AND public.is_pro(auth.uid()));
