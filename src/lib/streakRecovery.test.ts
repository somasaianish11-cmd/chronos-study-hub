import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { recoveryCountdown, recoveryResetAt } from "./streakRecovery";

describe("seven-day recovery reset", () => {
  it("resets exactly seven days after the last use, not Monday", () => {
    expect(recoveryResetAt("2026-11-13T18:27:00Z")).toBe(Date.parse("2026-11-20T18:27:00Z"));
  });
  it("counts down the remaining absolute time", () => {
    expect(recoveryCountdown("2026-11-13T18:27:00Z", Date.parse("2026-11-14T18:27:00Z"))).toBe("Resets in 6d 0h 0m 0s");
  });
  it("never shows a negative remaining duration", () => {
    expect(recoveryCountdown("2026-11-13T18:27:00Z", Date.parse("2026-11-21T18:27:00Z"))).toBe("Weekly reset due");
  });
  it("does not invent a reset when no recovery date exists", () => {
    expect(recoveryResetAt(null)).toBeNull();
    expect(recoveryResetAt("invalid")).toBeNull();
  });
});