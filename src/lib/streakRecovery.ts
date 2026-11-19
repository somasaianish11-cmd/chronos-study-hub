import { supabase } from "@/integrations/supabase/client";
import { fetchUserStreak, normalizeStreak, UserStreak } from "@/lib/streaks";

export interface RecoveryLog {
  id: string;
  user_id: string;
  recovered_date: string;
  days_restored: number;
  used_at: string;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function recoveryResetAt(usedAt: string | null): number | null {
  if (!usedAt) return null;
  const time = Date.parse(usedAt);
  return Number.isFinite(time) ? time + WEEK_MS : null;
}

/** Refill only an expired, still-empty balance; concurrent loads cannot refill twice. */
export async function refillExpiredRecovery(userId: string, streak: UserStreak): Promise<UserStreak> {
  const now = Date.now();
  const resetAt = recoveryResetAt(streak.updated_at ?? null);
  if (streak.freeze_count !== 0 || resetAt === null || now < resetAt) return streak;

  const { data, error } = await (supabase as any)
    .from("user_streaks")
    .update({ freeze_count: 1, streak_freezes_available: 1, updated_at: new Date(now).toISOString() })
    .eq("user_id", userId)
    .eq("freeze_count", 0)
    .eq("updated_at", streak.updated_at)
    .select("*")
    .maybeSingle();
  if (error) {
    console.warn("[Streak] recovery refill failed:", error.message);
    return streak;
  }
  return data ? normalizeStreak(data, userId) : (await fetchUserStreak(userId)) ?? streak;
}

export function recoveryCountdown(usedAt: string | null, now: number, fallbackAt?: string | null): string {
  const reset = recoveryResetAt(usedAt) ?? recoveryResetAt(fallbackAt ?? null);
  if (reset === null) return "Resets weekly";
  const remaining = Math.max(0, Math.ceil((reset - now) / 1000));
  if (remaining === 0) return "Weekly reset due";
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  return `Resets in ${days}d ${hours}h ${minutes}m ${seconds}s`;
}

export async function fetchRecoveryLogs(userId: string): Promise<RecoveryLog[]> {
  const { data, error } = await (supabase as any)
    .from("streak_recovery_logs")
    .select("id, user_id, recovered_date, days_restored, used_at")
    .eq("user_id", userId)
    .order("used_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function claimLoggedRecovery(today: string): Promise<{ days_restored: number; current_streak: number }> {
  const { data, error } = await (supabase as any).rpc("claim_streak_recovery", { p_today: today });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error("Recovery returned no result");
  return result;
}
/** Pro: restore every missed day without touching freeze_count or any cooldown. */
export async function claimUnlimitedRecovery(userId: string, streak: UserStreak, today: string): Promise<{ days_restored: number; current_streak: number }> {
  const { missedDays, sanitizeStreakPayload, yesterdayOf, STREAK_TABLE } = await import("@/lib/streaks");
  const missing = missedDays(streak.last_active_day ?? null, today);
  if (missing <= 0) throw new Error("Nothing to restore");
  const current_streak = (streak.current_streak ?? 0) + missing;
  const payload = sanitizeStreakPayload({ user_id: userId, current_streak, last_active_day: yesterdayOf(today), freeze_count: streak.freeze_count });
  const { error } = await (supabase as any).from(STREAK_TABLE).update(payload).eq("user_id", userId);
  if (error) throw error;
  const { error: logError } = await (supabase as any).from("streak_recovery_logs").insert({ user_id: userId, recovered_date: yesterdayOf(today), days_restored: missing, used_at: new Date().toISOString() });
  if (logError) console.warn("[Streak] recovery log failed:", logError.message);
  return { days_restored: missing, current_streak };
}
