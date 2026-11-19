import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { update, eq, maybeSingle } = vi.hoisted(() => ({
  update: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => {
    const chain = { update, eq, select: () => chain, maybeSingle };
    update.mockReturnValue(chain);
    eq.mockReturnValue(chain);
    return chain;
  },
} }));

import { refillExpiredRecovery } from "./streakRecovery";
import type { UserStreak } from "./streaks";

const now = Date.parse("2026-11-13T19:22:00Z");
const row: UserStreak = {
  user_id: "u1", current_streak: 4, longest_streak: 4,
  last_active_day: "2026-11-10", freeze_count: 0,
  streak_freezes_available: 0, updated_at: "2026-11-06T19:22:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(now);
  maybeSingle.mockResolvedValue({ data: { ...row, freeze_count: 1, streak_freezes_available: 1, updated_at: new Date(now).toISOString() }, error: null });
});
afterEach(() => vi.restoreAllMocks());

describe("recovery refill on load", () => {
  it("restores one recovery exactly seven days after updated_at", async () => {
    const result = await refillExpiredRecovery("u1", row);
    expect(update).toHaveBeenCalledWith({ freeze_count: 1, streak_freezes_available: 1, updated_at: "2026-11-13T19:22:00.000Z" });
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
    expect(eq).toHaveBeenCalledWith("freeze_count", 0);
    expect(eq).toHaveBeenCalledWith("updated_at", row.updated_at);
    expect(result.freeze_count).toBe(1);
    expect(result.streak_freezes_available).toBe(1);
    expect(result.current_streak).toBe(4);
  });
  it("restores one recovery after more than seven days", async () => {
    await refillExpiredRecovery("u1", { ...row, updated_at: "2026-11-01T19:22:00Z" });
    expect(update).toHaveBeenCalledOnce();
  });
  it("does not refill before seven full days", async () => {
    await refillExpiredRecovery("u1", { ...row, updated_at: "2026-11-06T19:22:01Z" });
    expect(update).not.toHaveBeenCalled();
  });
  it("leaves an available recovery untouched", async () => {
    await refillExpiredRecovery("u1", { ...row, freeze_count: 1 });
    expect(update).not.toHaveBeenCalled();
  });
  it("does not invent elapsed time when updated_at is missing", async () => {
    await refillExpiredRecovery("u1", { ...row, updated_at: null });
    expect(update).not.toHaveBeenCalled();
  });
  it("does not show a refill if saving fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    maybeSingle.mockResolvedValue({ data: null, error: { message: "Update denied" } });
    expect((await refillExpiredRecovery("u1", row)).freeze_count).toBe(0);
  });
});