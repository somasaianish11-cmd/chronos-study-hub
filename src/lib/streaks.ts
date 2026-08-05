import { supabase } from "@/integrations/supabase/client";

const dayStr = (d: Date) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return dayStr(d);
};

/** Monday (local) of the week containing `d`, as YYYY-MM-DD. */
export const mondayOf = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - diff);
  return dayStr(x);
};

/** Monday 00:00 UTC of the week containing `d`, as YYYY-MM-DD.
 *  Used for the Pro streak-recovery allowance, which resets weekly in UTC. */
export const utcMondayOf = (d: Date) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const diff = (x.getUTCDay() + 6) % 7; // 0 = Monday
  x.setUTCDate(x.getUTCDate() - diff);
  return x.toISOString().slice(0, 10);
};

export type BumpResult = {
  streak: number;
  /** true when a Pro streak recovery was consumed to save the streak */
  recovered: boolean;
  /** true when today was the user's first session of the day */
  firstToday: boolean;
};

/**
 * Increment the streak on the first completed session of the day.
 * Pro users get 1 streak recovery per week (resets every Monday): if they
 * missed exactly one day, the streak continues instead of resetting to 1.
 */
export async function bumpStreak(userId: string, isPro = false): Promise<BumpResult> {
  const today = dayStr(new Date());
  const yesterday = addDays(today, -1);
  const twoDaysAgo = addDays(today, -2);
  const weekStart = utcMondayOf(new Date());

  const { data: row } = await supabase
    .from("streaks")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    await supabase.from("streaks").insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_study_date: today,
    });
    return { streak: 1, recovered: false, firstToday: true };
  }

  // Already studied today — streak unchanged.
  if (row.last_study_date === today) {
    return { streak: row.current_streak, recovered: false, firstToday: false };
  }

  let newStreak: number;
  let recovered = false;
  let recoveryWeek = row.recovery_used_week;

  if (row.last_study_date === yesterday) {
    newStreak = row.current_streak + 1;
  } else if (
    isPro &&
    row.last_study_date === twoDaysAgo &&
    row.recovery_used_week !== weekStart &&
    row.current_streak > 0
  ) {
    // Missed exactly one day — spend this week's recovery to keep the chain.
    newStreak = row.current_streak + 1;
    recovered = true;
    recoveryWeek = weekStart;
  } else {
    newStreak = 1;
  }

  await supabase
    .from("streaks")
    .update({
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, row.longest_streak),
      last_study_date: today,
      recovery_used_week: recoveryWeek,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return { streak: newStreak, recovered, firstToday: true };
}
