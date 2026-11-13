import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const { state, rpc, historyQuery, auth } = vi.hoisted(() => ({
  state: { row: null as any, logs: [] as any[], error: null as any },
  rpc: vi.fn(),
  historyQuery: vi.fn(),
  auth: { user: { id: "u1" }, isPro: true, refreshProfile: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc,
  from(table: string) {
    const chain: any = {};
    chain.select = () => chain;
    chain.eq = (_key: string, userId: string) => { if (table === "streak_recovery_logs") historyQuery(userId); return chain; };
    chain.maybeSingle = async () => ({ data: state.row, error: null });
    chain.order = async () => ({ data: state.logs, error: null });
    return chain;
  },
} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import StreakRecoveryBadge from "./StreakRecoveryBadge";
import { localDay } from "@/lib/streaks";

const dayMinus = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDay(d);
};

beforeEach(() => {
  vi.clearAllMocks();
  state.row = { user_id: "u1", current_streak: 2, last_active_day: dayMinus(4), freeze_count: 5, streak_freezes_available: 5, last_recovery_used_at: null };
  state.logs = [];
  state.error = null;
  rpc.mockImplementation(async (_name, args) => {
    if (state.error) return { error: state.error, data: null };
    const restored = Math.min(state.row.streak_freezes_available, 3);
    state.row.current_streak += restored;
    state.row.streak_freezes_available -= restored;
    state.row.freeze_count = state.row.streak_freezes_available;
    state.row.last_recovery_used_at = new Date().toISOString();
    state.logs = [{ id: "log1", user_id: "u1", recovered_date: dayMinus(1), days_restored: restored, used_at: state.row.last_recovery_used_at }];
    return { error: null, data: [{ days_restored: restored, current_streak: state.row.current_streak }] };
  });
});

describe("StreakRecoveryBadge", () => {
  it("claims through the atomic logging operation and reads back history", async () => {
    render(<StreakRecoveryBadge />);
    fireEvent.click(await screen.findByRole("button", { name: /Streak Recovery available/i }));
    fireEvent.click(screen.getByRole("button", { name: /Claim Recovery/i }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("claim_streak_recovery", { p_today: localDay() }));
    await waitFor(() => expect(state.row.streak_freezes_available).toBe(2));
    expect(state.row.current_streak).toBe(5);
    await screen.findByText(/3 days restored · through/);
    expect(historyQuery).toHaveBeenCalledWith("u1");
    expect(auth.refreshProfile).toHaveBeenCalled();
  });

  it("allows partial recovery with fewer available freezes than missed days", async () => {
    state.row.streak_freezes_available = 2;
    render(<StreakRecoveryBadge />);
    fireEvent.click(await screen.findByRole("button", { name: /Streak Recovery available/i }));
    const claim = screen.getByRole("button", { name: /Claim Recovery/i });
    expect(claim).toBeEnabled();
    fireEvent.click(claim);
    await waitFor(() => expect(state.row.current_streak).toBe(4));
    expect(state.row.streak_freezes_available).toBe(0);
  });

  it("keeps zero-count history visible and prevents claiming", async () => {
    state.row.streak_freezes_available = 0;
    state.row.last_recovery_used_at = new Date().toISOString();
    state.logs = [{ id: "old", user_id: "u1", recovered_date: "2026-11-10", days_restored: 2, used_at: "2026-11-11T12:00:00Z" }];
    render(<StreakRecoveryBadge />);
    const badge = await screen.findByRole("button", { name: /0 recoveries available/i });
    await screen.findByText(/2 days restored · through 2026-11-10/);
    expect(screen.getByRole("timer")).toBeInTheDocument();
    fireEvent.click(badge);
    expect(screen.getByRole("button", { name: /Claim Recovery/i })).toBeDisabled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not show success or refresh after a failed transaction", async () => {
    state.error = { message: "History insert failed" };
    render(<StreakRecoveryBadge />);
    fireEvent.click(await screen.findByRole("button", { name: /Streak Recovery available/i }));
    fireEvent.click(screen.getByRole("button", { name: /Claim Recovery/i }));
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(state.row.streak_freezes_available).toBe(5);
    expect(state.logs).toHaveLength(0);
    expect(auth.refreshProfile).not.toHaveBeenCalled();
  });
});