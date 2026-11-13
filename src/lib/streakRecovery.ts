import { supabase } from "@/integrations/supabase/client";

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