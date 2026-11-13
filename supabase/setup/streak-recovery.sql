-- Apply to the external database used by the app, NOT the old managed Cloud database.
BEGIN;

ALTER TABLE public.user_streaks
  ADD COLUMN IF NOT EXISTS streak_freezes_available integer,
  ADD COLUMN IF NOT EXISTS last_recovery_used_at timestamptz;

UPDATE public.user_streaks SET streak_freezes_available = freeze_count
WHERE streak_freezes_available IS NULL;
ALTER TABLE public.user_streaks ALTER COLUMN streak_freezes_available SET DEFAULT 1;
ALTER TABLE public.user_streaks ALTER COLUMN streak_freezes_available SET NOT NULL;

CREATE TABLE public.streak_recovery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recovered_date date NOT NULL,
  days_restored integer NOT NULL CHECK (days_restored > 0),
  used_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.streak_recovery_logs TO authenticated;
GRANT ALL ON public.streak_recovery_logs TO service_role;
ALTER TABLE public.streak_recovery_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own recovery history" ON public.streak_recovery_logs
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX streak_recovery_logs_user_used_idx ON public.streak_recovery_logs (user_id, used_at DESC);

-- Preserve the timer's existing four-column write contract.
CREATE OR REPLACE FUNCTION public.sync_recovery_availability() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.streak_freezes_available := NEW.freeze_count;
  ELSIF NEW.freeze_count IS DISTINCT FROM OLD.freeze_count THEN
    NEW.streak_freezes_available := NEW.freeze_count;
  ELSIF NEW.streak_freezes_available IS DISTINCT FROM OLD.streak_freezes_available THEN
    NEW.freeze_count := NEW.streak_freezes_available;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sync_recovery_availability BEFORE INSERT OR UPDATE ON public.user_streaks
FOR EACH ROW EXECUTE FUNCTION public.sync_recovery_availability();

CREATE OR REPLACE FUNCTION public.claim_streak_recovery(p_today date)
RETURNS TABLE(days_restored integer, current_streak integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  streak_row public.user_streaks%ROWTYPE;
  missing integer;
  restored integer;
  recovered_day date;
  claim_time timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to claim a recovery'; END IF;
  -- Accept the user's local calendar day, never an arbitrary future date.
  IF p_today IS NULL OR abs(p_today - CURRENT_DATE) > 1 THEN
    RAISE EXCEPTION 'Invalid recovery date';
  END IF;
  SELECT * INTO streak_row FROM public.user_streaks
  WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No streak to recover'; END IF;
  missing := greatest(0, p_today - streak_row.last_active_day::date - 1);
  restored := least(streak_row.streak_freezes_available, missing);
  IF restored <= 0 THEN RAISE EXCEPTION 'No recovery available for missed days'; END IF;
  recovered_day := streak_row.last_active_day::date + restored;
  UPDATE public.user_streaks SET
    current_streak = streak_row.current_streak + restored,
    last_active_day = recovered_day,
    freeze_count = streak_row.streak_freezes_available - restored,
    streak_freezes_available = streak_row.streak_freezes_available - restored,
    last_recovery_used_at = claim_time
  WHERE user_id = auth.uid();
  INSERT INTO public.streak_recovery_logs (user_id, recovered_date, days_restored, used_at)
  VALUES (auth.uid(), recovered_day, restored, claim_time);
  RETURN QUERY SELECT restored, (streak_row.current_streak + restored)::integer;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_streak_recovery(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_streak_recovery(date) TO authenticated;
COMMIT;