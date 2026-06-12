import { describe, expect, it } from "vitest";

import { doNext, isActionable, rankTasks, taskScore } from "./ranking";
import { makeTask, NOW } from "./__tests__helpers";

describe("ranking", () => {
  it("excludes done and snoozed tasks", () => {
    expect(isActionable(makeTask({ done: true }), NOW)).toBe(false);
    expect(
      isActionable(makeTask({ snoozed_until: "2026-06-12T00:00:00.000Z" }), NOW),
    ).toBe(false);
    expect(
      isActionable(makeTask({ snoozed_until: "2026-06-10T00:00:00.000Z" }), NOW),
    ).toBe(true);
  });

  it("orders: overdue > today > tomorrow > later > undated (at equal priority)", () => {
    const overdue = makeTask({ id: "a", due_date: "2026-06-09" });
    const today = makeTask({ id: "b", due_date: "2026-06-11" });
    const tomorrow = makeTask({ id: "c", due_date: "2026-06-12" });
    const later = makeTask({ id: "d", due_date: "2026-07-30" });
    const undated = makeTask({ id: "e" });
    const ranked = rankTasks([undated, later, tomorrow, today, overdue], NOW);
    expect(ranked.map((t) => t.id)).toEqual(["a", "b", "c", "e", "d"]);
  });

  it("priority lifts a task within the same urgency band", () => {
    const low = makeTask({ id: "low", due_date: "2026-06-11", priority: 2 });
    const high = makeTask({ id: "high", due_date: "2026-06-11", priority: 5 });
    expect(rankTasks([low, high], NOW)[0]?.id).toBe("high");
  });

  it("quick wins nudge short tasks up", () => {
    const quick = makeTask({ id: "q", estimate_minutes: 20 });
    const slog = makeTask({ id: "s", estimate_minutes: 180 });
    expect(taskScore(quick, NOW)).toBeGreaterThan(taskScore(slog, NOW));
  });

  it("a top-priority future task can outrank a low-priority due-today task", () => {
    const dueTodayLow = makeTask({ id: "today-low", due_date: "2026-06-11", priority: 1 });
    const soonTop = makeTask({ id: "soon-top", due_date: "2026-06-12", priority: 5 });
    expect(rankTasks([dueTodayLow, soonTop], NOW)[0]?.id).toBe("soon-top");
  });

  it("ties break deterministically (due asc, priority desc, created asc, id)", () => {
    const a = makeTask({ id: "a", created_at: "2026-06-01T09:00:00.000Z" });
    const b = makeTask({ id: "b", created_at: "2026-06-01T09:00:00.000Z" });
    const first = rankTasks([b, a], NOW);
    const second = rankTasks([a, b], NOW);
    expect(first.map((t) => t.id)).toEqual(second.map((t) => t.id));
    expect(first[0]?.id).toBe("a");
  });

  it("doNext returns null when nothing is actionable", () => {
    expect(doNext([makeTask({ done: true })], NOW)).toBeNull();
  });
});
