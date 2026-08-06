
CREATE OR REPLACE FUNCTION public.apply_session_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date := (NEW.completed_at AT TIME ZONE 'UTC')::date;
  existing public.streaks%ROWTYPE;
  new_streak integer;
BEGIN
  SELECT * INTO existing FROM public.streaks WHERE user_id = NEW.user_id;

  IF NOT FOUND THEN
    INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_study_date, updated_at)
    VALUES (NEW.user_id, 1, 1, today, now())
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
  END IF;

  IF existing.last_study_date = today THEN
    -- already counted today, but never leave it at 0
    IF existing.current_streak < 1 THEN
      UPDATE public.streaks
      SET current_streak = 1,
          longest_streak = GREATEST(1, existing.longest_streak),
          updated_at = now()
      WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;

  IF existing.last_study_date = today - 1 THEN
    new_streak := GREATEST(existing.current_streak, 0) + 1;
  ELSE
    new_streak := 1;
  END IF;

  UPDATE public.streaks
  SET current_streak = new_streak,
      longest_streak = GREATEST(new_streak, existing.longest_streak),
      last_study_date = today,
      updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_study_session_streak ON public.study_sessions;
CREATE TRIGGER on_study_session_streak
AFTER INSERT ON public.study_sessions
FOR EACH ROW EXECUTE FUNCTION public.apply_session_streak();

-- Backfill: users with sessions but a zeroed streak row
UPDATE public.streaks s
SET current_streak = GREATEST(s.current_streak, 1),
    longest_streak = GREATEST(s.longest_streak, 1),
    last_study_date = COALESCE(s.last_study_date, x.last_day),
    updated_at = now()
FROM (
  SELECT user_id, MAX((completed_at AT TIME ZONE 'UTC')::date) AS last_day
  FROM public.study_sessions GROUP BY user_id
) x
WHERE x.user_id = s.user_id AND s.current_streak < 1;
