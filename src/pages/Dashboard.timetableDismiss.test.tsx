import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { state, auth } = vi.hoisted(() => ({
  state: {
    tables: {} as Record<string, any[]>,
    writes: [] as { table: string; op: string }[],
  },
  // Stable identity: a new object per render would re-trigger the dashboard's load effect.
  auth: { user: { id: "u1" }, isPro: false },
}));

vi.mock("@/integrations/supabase/client", () => {
  const mkChain = (table: string): any => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      lte: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: (state.tables[table] || [])[0] ?? null, error: null }),
      update: () => { state.writes.push({ table, op: "update" }); return chain; },
      delete: () => { state.writes.push({ table, op: "delete" }); return chain; },
      insert: () => { state.writes.push({ table, op: "insert" }); return chain; },
      then: (resolve: any, reject?: any) =>
        Promise.resolve({ data: state.tables[table] || [], error: null }).then(resolve, reject),
    };
    return chain;
  };
  const chan: any = { on: () => chan, subscribe: () => chan };
  return {
    supabase: {
      from: (table: string) => mkChain(table),
      rpc: async () => ({ data: [], error: null }),
      channel: () => chan,
      removeChannel: () => {},
    },
  };
});

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/components/StreakRecoveryBadge", () => ({ default: () => null }));
vi.mock("react-router-dom", () => ({
  Link: ({ to, children }: any) => <a href={to}>{children}</a>,
}));

import Dashboard from "./Dashboard";

const PREFIX = "chronos:timetable-dismissed:";
const keyFor = (d: Date) =>
  `${PREFIX}${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const SLOTS = [
  { id: "s1", start_time: "09:00", end_time: "10:00", subjects: { name: "Bio", color: "#7c6ff7" } },
  { id: "s2", start_time: "11:00", end_time: "12:00", subjects: { name: "Pre Cal 11", color: "#f97066" } },
];

beforeEach(() => {
  window.localStorage.clear();
  state.writes = [];
  state.tables = { timetable_slots: SLOTS, user_streaks: [], homework: [], study_sessions: [], exams: [] };
});

describe("Dashboard timetable dismissal", () => {
  it("hides a class for today and stores it under today's local date key", async () => {
    render(<Dashboard />);
    await screen.findByText("Bio");

    fireEvent.click(screen.getByRole("button", { name: /Mark Bio as done for today/i }));

    expect(screen.queryByText("Bio")).toBeNull();
    expect(screen.getByText("Pre Cal 11")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(keyFor(new Date())) || "[]")).toEqual(["s1"]);
    expect(state.writes).toEqual([]);
  });

  it("shows an all-done empty state that can reveal and undo cleared classes", async () => {
    render(<Dashboard />);
    await screen.findByText("Bio");

    fireEvent.click(screen.getByRole("button", { name: /Mark Bio as done for today/i }));
    fireEvent.click(screen.getByRole("button", { name: /Mark Pre Cal 11 as done for today/i }));

    expect(screen.getByText("All done for today 🎉")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Show cleared \(2\)/i }));
    expect(screen.getByText("Bio")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Show Bio again today/i }));
    expect(screen.getByText("Bio")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(keyFor(new Date())) || "[]")).toEqual(["s2"]);
    expect(state.writes).toEqual([]);
  });

  it("starts clean on a new local day", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    window.localStorage.setItem(keyFor(yesterday), JSON.stringify(["s1", "s2"]));

    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("Bio")).toBeInTheDocument());

    expect(screen.getByText("Pre Cal 11")).toBeInTheDocument();
    expect(screen.queryByText("All done for today 🎉")).toBeNull();
  });
});
