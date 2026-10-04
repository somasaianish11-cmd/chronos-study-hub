import { supabase } from "@/integrations/supabase/client";

export const STREAK_TABLE = "user_streaks";

export type UserStreak = {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  streak_freezes_available: number;
  last_recovery_used_at: string | null;
};

const ALLOWED_KEYS: (keyof UserStreak)[] = [
  "user_id",
  "current_streak",
  "longest_streak",
  "last_active_date",
  "streak_freezes_available",
  "last_recovery_used_at",
];

/** Local calendar day as YYYY-MM-DD. */
export const localDay = (d: Date = new Date()) => d.toLocaleDateString("en-CA");

const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const toInt = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Strip unknown keys and coerce types so Supabase never sees a schema mismatch (400). */
export function sanitizeStreakPayload(input: Partial<Record<string, unknown>>): Partial<UserStreak> {
  const out: Partial<UserStreak> = {};
  for (const key of ALLOWED_KEYS) {
    if (!(key in input) || input[key] === undefined) continue;
    const v = input[key];
    switch (key) {
      case "user_id":
        if (typeof v === "string" && v) out.user_id = v;
        break;
      case "current_streak":
      case "longest_streak":
      case "streak_freezes_available":
        out[key] = toInt(v);
        break;
      case "last_active_date":
        out.last_active_date = isDay(v) ? (v as string) : null;
        break;
      case "last_recovery_used_at": {
        const d = v ? new Date(v as string) : null;
        out.last_recovery_used_at = d && !isNaN(d.getTime()) ? d.toISOString() : null;
        break;
      }
    }
  }
  return out;
}

/** Normalise a raw row (nulls / missing columns) into a safe UserStreak. */
export function normalizeStreak(row: any, userId: string): UserStreak {
  return {
    user_id: userId,
    current_streak: toInt(row?.current_streak),
    longest_streak: toInt(row?.longest_streak),
    last_active_date: isDay(row?.last_active_date) ? row.last_active_date : null,
    streak_freezes_available: toInt(row?.streak_freezes_available),
    last_recovery_used_at: row?.last_recovery_used_at ?? null,
  };
}

/**
 * Days missed between the last active day and today (exclusive of both).
 * last=yesterday or today -> 0. last=3 days ago -> 2 missed days.
 */
export function missedDays(lastActive: string | null, today: string = localDay()): number {
  if (!lastActive) return 0;
  const a = new Date(lastActive + "T00:00:00").getTime();
  const b = new Date(today + "T00:00:00").getTime();
  const diff = Math.round((b - a) / 86400000);
  return Math.max(0, diff - 1);
}

export const yesterdayOf = (today: string = localDay()) => {
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return localDay(d);
};

export async function fetchUserStreak(userId: string): Promise<UserStreak | null> {
  const { data, error } = await (supabase as any)
    .from(STREAK_TABLE)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[Streak] fetch failed:", error.message);
    return null;
  }
  return data ? normalizeStreak(data, userId) : null;
}

/**
 * Post-session streak updater — single client-side writer for user_streaks.
 * If last_active_date is not today, increments current_streak by 1 and sets
 * last_active_date to today (local YYYY-MM-DD). Payload is sanitized before
 * saving so no unknown keys reach Supabase (prevents 400 schema mismatches).
 */
export async function applySessionStreak(userId: string): Promise<void> {
  const today = localDay();
  const existing = await fetchUserStreak(userId);

  if (existing?.last_active_date === today) return; // already counted today

  const current = (existing?.current_streak ?? 0) + 1;
  const longest = Math.max(existing?.longest_streak ?? 0, current);

  const payload = sanitizeStreakPayload({
    user_id: userId,
    current_streak: current,
    longest_streak: longest,
    last_active_date: today,
    streak_freezes_available: existing?.streak_freezes_available ?? 1,
    last_recovery_used_at: existing?.last_recovery_used_at ?? null,
  });

  const { error } = await (supabase as any)
    .from(STREAK_TABLE)
    .upsert(payload, { onConflict: "user_id" });
  if (error) {
    console.warn("[Streak] update failed:", error.message);
  }
}
