import { supabase } from "@/integrations/supabase/client";

export const STREAK_TABLE = "user_streaks";

/**
 * The only columns user_streaks has that we are allowed to write.
 * Sending anything else (e.g. last_recovery_used_at, longest_streak) makes
 * PostgREST fail with a 400 schema-cache error.
 */
export type StreakWrite = {
  user_id: string;
  current_streak: number;
  last_active_day: string | null;
  freeze_count: number;
};

/** Read shape. longest_streak is display-only and never sent back to the database. */
export type UserStreak = StreakWrite & { longest_streak: number };

const WRITE_KEYS: (keyof StreakWrite)[] = [
  "user_id",
  "current_streak",
  "last_active_day",
  "freeze_count",
];

/** Local calendar day as YYYY-MM-DD. */
export const localDay = (d: Date = new Date()) => d.toLocaleDateString("en-CA");

const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const toInt = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/**
 * Keep only the four columns user_streaks actually accepts and coerce their
 * types, so an extra or mis-typed field can never trigger a 400 schema mismatch.
 */
export function sanitizeStreakPayload(input: Partial<Record<string, unknown>>): Partial<StreakWrite> {
  const out: Partial<StreakWrite> = {};
  for (const key of WRITE_KEYS) {
    if (!(key in input) || input[key] === undefined) continue;
    const v = input[key];
    switch (key) {
      case "user_id":
        if (typeof v === "string" && v.trim()) out.user_id = v.trim();
        break;
      case "current_streak":
      case "freeze_count":
        out[key] = toInt(v);
        break;
      case "last_active_day":
        out.last_active_day = isDay(v) ? (v as string) : null;
        break;
    }
  }
  return out;
}

/** Normalise a raw row (nulls / missing columns) into a safe UserStreak. */
export function normalizeStreak(row: any, userId: string): UserStreak {
  const current = toInt(row?.current_streak);
  return {
    user_id: userId,
    current_streak: current,
    longest_streak: toInt(row?.longest_streak) || current,
    last_active_day: isDay(row?.last_active_day) ? row.last_active_day : null,
    freeze_count: toInt(row?.freeze_count ?? row?.streak_freezes_available),
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
 * If last_active_day is not today, increments current_streak by 1 and sets
 * last_active_day to today (local YYYY-MM-DD). The payload is sanitized down to
 * the four real columns before saving so no unknown key reaches Supabase.
 */
export async function applySessionStreak(userId: string): Promise<void> {
  console.log('[Streak] Attempting update for user:', userId);
  const today = localDay();
  const existing = await fetchUserStreak(userId);

  if (existing?.last_active_day === today) return; // already counted today

  const current = (existing?.current_streak ?? 0) + 1;

  const payload = sanitizeStreakPayload({
    user_id: userId,
    current_streak: current,
    last_active_day: today,
    freeze_count: existing?.freeze_count ?? 1,
  });

  const { error } = await (supabase as any)
    .from(STREAK_TABLE)
    .upsert(payload, { onConflict: "user_id" });
  if (error) {
    console.warn("[Streak] update failed:", error.message);
  }
}
