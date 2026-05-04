import { supabase } from "@/integrations/supabase/client";

export async function bumpStreak(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: row } = await supabase.from("streaks").select("*").eq("user_id", userId).maybeSingle();
  if (!row) {
    await supabase.from("streaks").insert({ user_id: userId, current_streak: 1, longest_streak: 1, last_study_date: today });
    return 1;
  }
  if (row.last_study_date === today) return row.current_streak;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = row.last_study_date === yesterday ? row.current_streak + 1 : 1;
  await supabase.from("streaks").update({
    current_streak: newStreak,
    longest_streak: Math.max(newStreak, row.longest_streak),
    last_study_date: today,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  return newStreak;
}
