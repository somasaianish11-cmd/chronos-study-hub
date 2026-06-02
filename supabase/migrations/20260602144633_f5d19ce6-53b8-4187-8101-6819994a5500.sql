
REVOKE EXECUTE ON FUNCTION public.is_pro(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.weekly_leaderboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_pro(uuid) TO authenticated;
