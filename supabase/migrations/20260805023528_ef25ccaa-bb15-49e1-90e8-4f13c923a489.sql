DROP FUNCTION IF EXISTS public.weekly_leaderboard();

CREATE OR REPLACE FUNCTION public.weekly_leaderboard()
RETURNS TABLE(user_id uuid, display_name text, total_minutes bigint, session_count bigint, joined_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.user_id,
         COALESCE(p.display_name, 'Student') AS display_name,
         SUM(s.duration_minutes)::bigint AS total_minutes,
         COUNT(*)::bigint AS session_count,
         MIN(p.created_at) AS joined_at
  FROM public.study_sessions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE s.completed_at >= date_trunc('week', now())
  GROUP BY s.user_id, p.display_name
  ORDER BY total_minutes DESC, session_count DESC, MIN(p.created_at) ASC, s.user_id ASC
  LIMIT 100;
$function$;

REVOKE ALL ON FUNCTION public.weekly_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.weekly_leaderboard() TO authenticated;