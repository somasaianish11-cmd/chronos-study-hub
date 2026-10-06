import { describe, it, expect, vi, beforeEach } from "vitest";

const { supabaseMock, calls, state } = vi.hoisted(() => {
  const calls: { op: string; table: string; payload: any }[] = [];
  const state = { row: null as any };
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
  return { supabaseMock, calls, state };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { applySessionStreak, sanitizeStreakPayload, localDay, missedDays } from "@/lib/streaks";

const dayMinus = (n: number) => {
  const d = new Date(localDay() + "T00:00:00");
  d.setDate(d.getDate() - n);
  return localDay(d);
};

const WRITE_KEYS = ["current_streak", "freeze_count", "last_active_day", "user_id"];

beforeEach(() => {
  calls.length = 0;
  state.row = null;
});

describe("applySessionStreak payload", () => {
  it("upserts exactly the four real columns and increments a broken streak", async () => {
    state.row = {
      user_id: "u1",
      current_streak: 3,
      longest_streak: 9,
      last_active_day: dayMinus(4),
      freeze_count: 2,
      last_recovery_used_at: "2026-01-01T00:00:00.000Z",
    };

    await applySessionStreak("u1");

    const write = calls.find((c) => c.op === "upsert");
    expect(write, "a streak write should have been attempted").toBeTruthy();
    expect(Object.keys(write!.payload).sort()).toEqual(WRITE_KEYS);
    expect(write!.payload.current_streak).toBe(4);
    expect(write!.payload.last_active_day).toBe(localDay());
    expect(write!.payload.freeze_count).toBe(2);
    expect(write!.payload).not.toHaveProperty("last_recovery_used_at");
    expect(write!.payload).not.toHaveProperty("longest_streak");
    expect(write!.payload).not.toHaveProperty("streak_freezes_available");
  });

  it("writes nothing when the user already studied today", async () => {
    state.row = {
      user_id: "u1",
      current_streak: 5,
      last_active_day: localDay(),
      freeze_count: 1,
    };
    await applySessionStreak("u1");
    expect(calls.filter((c) => c.op === "upsert" || c.op === "update")).toHaveLength(0);
  });

  it("starts a streak for a user with no row yet", async () => {
    state.row = null;
    await applySessionStreak("u1");
    const write = calls.find((c) => c.op === "upsert");
    expect(Object.keys(write!.payload).sort()).toEqual(WRITE_KEYS);
    expect(write!.payload.current_streak).toBe(1);
  });

  it("strips unknown / renamed columns from any payload", () => {
    const out = sanitizeStreakPayload({
      user_id: "u1",
      current_streak: "7",
      last_active_day: dayMinus(2),
      freeze_count: "3",
      longest_streak: 12,
      last_recovery_used_at: new Date().toISOString(),
      streak_freezes_available: 4,
      study_date: "2026-01-01",
      recovery_used_week: "2026-40",
    });
    expect(Object.keys(out).sort()).toEqual(WRITE_KEYS);
    expect(out.current_streak).toBe(7);
    expect(out.freeze_count).toBe(3);
  });
});

describe("missedDays", () => {
  it("counts the gap between the last active day and today", () => {
    expect(missedDays(localDay())).toBe(0);
    expect(missedDays(dayMinus(1))).toBe(0);
    expect(missedDays(dayMinus(4))).toBe(3);
    expect(missedDays(null)).toBe(0);
  });
});
