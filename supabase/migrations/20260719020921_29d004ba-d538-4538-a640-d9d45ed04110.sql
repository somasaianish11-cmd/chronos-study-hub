
CREATE TABLE IF NOT EXISTS public.battle_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_name TEXT NOT NULL,
  host_progress NUMERIC NOT NULL DEFAULT 0,
  guest_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_progress NUMERIC NOT NULL DEFAULT 0,
  duration_minutes INT NOT NULL DEFAULT 25,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.battle_rooms TO authenticated;
GRANT ALL ON public.battle_rooms TO service_role;

ALTER TABLE public.battle_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read rooms" ON public.battle_rooms;
CREATE POLICY "Authenticated can read rooms" ON public.battle_rooms
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Host can insert own rooms" ON public.battle_rooms;
CREATE POLICY "Host can insert own rooms" ON public.battle_rooms
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_user_id);

DROP POLICY IF EXISTS "Participants can update room" ON public.battle_rooms;
CREATE POLICY "Participants can update room" ON public.battle_rooms
  FOR UPDATE TO authenticated
  USING (auth.uid() = host_user_id OR auth.uid() = guest_user_id OR guest_user_id IS NULL)
  WITH CHECK (auth.uid() = host_user_id OR auth.uid() = guest_user_id);

DROP POLICY IF EXISTS "Host can delete own rooms" ON public.battle_rooms;
CREATE POLICY "Host can delete own rooms" ON public.battle_rooms
  FOR DELETE TO authenticated USING (auth.uid() = host_user_id);

ALTER TABLE public.battle_rooms REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_rooms;
