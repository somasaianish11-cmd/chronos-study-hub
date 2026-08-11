ALTER TABLE public.study_sessions
ADD COLUMN IF NOT EXISTS study_date date;

UPDATE public.study_sessions
SET study_date = (completed_at AT TIME ZONE 'UTC')::date
WHERE study_date IS NULL;

ALTER TABLE public.study_sessions
ALTER COLUMN study_date SET DEFAULT CURRENT_DATE,
ALTER COLUMN study_date SET NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_session_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_day date := NEW.study_date;
BEGIN
  INSERT INTO public.streaks (
    user_id,
    current_streak,
    longest_streak,
    last_study_date,
    updated_at
  )
  VALUES (NEW.user_id, 1, 1, session_day, now())
  ON CONFLICT (user_id) DO UPDATE
  SET current_streak = CASE
        WHEN public.streaks.last_study_date > session_day
          THEN public.streaks.current_streak
        WHEN public.streaks.last_study_date = session_day
          THEN GREATEST(public.streaks.current_streak, 1)
        WHEN public.streaks.last_study_date = session_day - 1
          THEN GREATEST(public.streaks.current_streak, 0) + 1
        ELSE 1
      END,
      longest_streak = GREATEST(
        public.streaks.longest_streak,
        CASE
          WHEN public.streaks.last_study_date > session_day
            THEN public.streaks.current_streak
          WHEN public.streaks.last_study_date = session_day
            THEN GREATEST(public.streaks.current_streak, 1)
          WHEN public.streaks.last_study_date = session_day - 1
            THEN GREATEST(public.streaks.current_streak, 0) + 1
          ELSE 1
        END
      ),
      last_study_date = GREATEST(public.streaks.last_study_date, session_day),
      updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_study_session_streak ON public.study_sessions;
CREATE TRIGGER on_study_session_streak
AFTER INSERT ON public.study_sessions
FOR EACH ROW EXECUTE FUNCTION public.apply_session_streak();

REVOKE ALL ON FUNCTION public.apply_session_streak() FROM PUBLIC, anon, authenticated;