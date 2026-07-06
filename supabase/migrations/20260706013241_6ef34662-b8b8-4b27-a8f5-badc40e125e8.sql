ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS interval_days numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repetitions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_review_date timestamptz;