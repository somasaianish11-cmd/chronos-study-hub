import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const { supabaseMock, calls, state, auth } = vi.hoisted(() => {
  const calls: { op: string; table: string; payload: any }[] = [];
  const state = { row: null as any };
  const auth = {
    user: { id: "u1" } as any,
    isPro: true,
    refreshProfile: vi.fn(async () => {}),
  };
  const supabaseMock = {
    from(table: string) {
      const chain: any = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => ({ data: state.row, error: null });
      chain.update = (payload: any) => {
        calls.push({ op: "update", table, payload });
        return { eq: () => Promise.resolve({ error: null }) };
      };
      chain.upsert = (payload: any) => {
        calls.push({ op: "upsert", table, payload });
        return Promise.resolve({ error: null });
      };
      return chain;
    },
  };
  return { supabaseMock, calls, state, auth };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import StreakRecoveryBadge from "@/components/StreakRecoveryBadge";
import { localDay } from "@/lib/streaks";

const dayMinus = (n: number) => {
  const d = new Date(localDay() + "T00:00:00");
  d.setDate(d.getDate() - n);
  return localDay(d);
};

beforeEach(() => {
  calls.length = 0;
  state.row = {
    user_id: "u1",
    current_streak: 2,
    longest_streak: 8,
    last_active_day: dayMinus(4), // 3 missed days
    freeze_count: 5,
    last_recovery_used_at: "2026-01-01T00:00:00.000Z",
  };
});

describe("StreakRecoveryBadge claim", () => {
  it("sends only the columns user_streaks has when claiming a recovery", async () => {
    render(<StreakRecoveryBadge />);

    const badge = await screen.findByRole("button", { name: /Streak Recovery available/i });
    expect(badge).toHaveTextContent("5 Streak Recovery available");
    await waitFor(() => expect(badge).toHaveTextContent("5 Streak Recovery available"));

    fireEvent.click(badge);
    // Modal should offer the dynamically computed gap, never a hardcoded "+3 Days".
    expect(await screen.findByText(/Restore 3 missed days/i)).toBeInTheDocument();
    expect(screen.queryByText(/\+3 Days/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Claim Recovery/i }));

    await waitFor(() => expect(calls.some((c) => c.op === "update")).toBe(true));
    const write = calls.find((c) => c.op === "update")!;
    expect(write.table).toBe("user_streaks");
    expect(Object.keys(write.payload).sort()).toEqual([
      "current_streak",
      "freeze_count",
      "last_active_day",
    ]);
    expect(write.payload.current_streak).toBe(5); // 2 + 3 restored
    expect(write.payload.last_active_day).toBe(dayMinus(1));
    expect(write.payload.freeze_count).toBe(2); // 5 - 3 missed days
    expect(write.payload).not.toHaveProperty("last_recovery_used_at");
    expect(write.payload).not.toHaveProperty("longest_streak");
    expect(write.payload).not.toHaveProperty("streak_freezes_available");
    expect(auth.refreshProfile).toHaveBeenCalled();
  });

  it("shows an inactive badge when no freezes remain", async () => {
    state.row.freeze_count = 0;
    render(<StreakRecoveryBadge />);
    const badge = await screen.findByText(/No recoveries left/i);
    expect(badge).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Streak Recovery available/i })).toBeNull();
  });
});
