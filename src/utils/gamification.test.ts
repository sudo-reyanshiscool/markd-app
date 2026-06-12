import { describe, expect, it } from "vitest";

import { Paper, StudySession, TopicConfidence } from "@/db/schemas";

import {
  activityDateSet,
  levelForXp,
  streakDays,
  subjectHealth,
  totalXp,
  weeklySummary,
  xpThreshold,
} from "./gamification";
import { makeTask, NOW } from "./__tests__helpers";

function makeSession(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: `s-${Math.random().toString(36).slice(2, 8)}`,
    user_id: "u1",
    subject_id: null,
    task_id: null,
    minutes: 25,
    started_at: null,
    completed_at: "2026-06-11T09:00:00.000Z",
    ...overrides,
  };
}

function makePaper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: `p-${Math.random().toString(36).slice(2, 8)}`,
    user_id: "u1",
    subject_id: "sub1",
    title: null,
    year: null,
    paper_number: null,
    scored: null,
    total: null,
    taken_on: null,
    notes: null,
    created_at: "2026-06-01T09:00:00.000Z",
    ...overrides,
  };
}

describe("xp + levels", () => {
  it("totals xp by the documented rules", () => {
    expect(totalXp({ tasksCompleted: 3, studyMinutes: 50, papersLogged: 2 })).toBe(
      3 * 10 + 50 + 2 * 15,
    );
  });

  it("thresholds form the triangular curve", () => {
    expect(xpThreshold(1)).toBe(100);
    expect(xpThreshold(2)).toBe(300);
    expect(xpThreshold(3)).toBe(600);
  });

  it("levelForXp brackets correctly with progress", () => {
    expect(levelForXp(0).level).toBe(1);
    expect(levelForXp(99).level).toBe(1);
    expect(levelForXp(100).level).toBe(2);
    const info = levelForXp(200);
    expect(info.level).toBe(2);
    expect(info.into).toBe(100);
    expect(info.span).toBe(200);
    expect(info.progress).toBeCloseTo(0.5);
  });
});

describe("streak", () => {
  // NOW is Thu 11 Jun 2026 (local)
  it("counts consecutive days ending today", () => {
    const dates = new Set(["2026-06-11", "2026-06-10", "2026-06-09"]);
    const s = streakDays(dates, NOW);
    expect(s.days).toBe(3);
    expect(s.aliveToday).toBe(true);
    expect(s.atRisk).toBe(false);
  });

  it("grace: yesterday-anchored streak is at risk, not dead", () => {
    const dates = new Set(["2026-06-10", "2026-06-09"]);
    const s = streakDays(dates, NOW);
    expect(s.days).toBe(2);
    expect(s.aliveToday).toBe(false);
    expect(s.atRisk).toBe(true);
  });

  it("a gap breaks the streak", () => {
    const dates = new Set(["2026-06-11", "2026-06-09"]);
    expect(streakDays(dates, NOW).days).toBe(1);
  });

  it("no recent activity → zero", () => {
    expect(streakDays(new Set(["2026-06-01"]), NOW).days).toBe(0);
  });

  it("activityDateSet merges completed tasks and sessions", () => {
    // local-noon timestamps so the local-date conversion is unambiguous
    const t11 = new Date(2026, 5, 11, 12, 0).toISOString();
    const t10 = new Date(2026, 5, 10, 12, 0).toISOString();
    const tasks = [
      makeTask({ done: true, completed_at: t11 }),
      makeTask({ done: false }),
    ];
    const sessions = [makeSession({ completed_at: t10 })];
    const dates = activityDateSet(tasks, sessions);
    expect(dates.has("2026-06-11")).toBe(true);
    expect(dates.has("2026-06-10")).toBe(true);
    expect(dates.size).toBe(2);
  });
});

describe("weeklySummary", () => {
  // Week of Mon 8 Jun – Thu 11 Jun (NOW)
  it("counts only this week's items", () => {
    const local = (d: number) => new Date(2026, 5, d, 12, 0).toISOString();
    const tasks = [
      makeTask({ done: true, completed_at: local(9) }),
      makeTask({ done: true, completed_at: local(5) }), // last week
    ];
    const sessions = [
      makeSession({ minutes: 25, completed_at: local(8) }),
      makeSession({ minutes: 45, completed_at: local(11) }),
      makeSession({ minutes: 60, completed_at: local(6) }), // last week
    ];
    const papers = [
      makePaper({ taken_on: "2026-06-10" }),
      makePaper({ taken_on: "2026-05-10" }),
    ];
    const w = weeklySummary(tasks, sessions, papers, NOW);
    expect(w.tasksDone).toBe(1);
    expect(w.studyMinutes).toBe(70);
    expect(w.papersLogged).toBe(1);
  });
});

describe("subjectHealth", () => {
  const conf = (c: number): TopicConfidence => ({
    id: "c1",
    user_id: "u1",
    subject_id: "sub1",
    topic: "t",
    confidence: c,
  });

  it("returns none with no signal", () => {
    expect(subjectHealth([], []).band).toBe("none");
    expect(subjectHealth([], []).score).toBeNull();
  });

  it("strong subject: high papers + high confidence + upward trend", () => {
    const papers = [
      makePaper({ scored: 60, total: 100, taken_on: "2026-05-01" }),
      makePaper({ scored: 75, total: 100, taken_on: "2026-05-20" }),
      makePaper({ scored: 88, total: 100, taken_on: "2026-06-05" }),
    ];
    const h = subjectHealth(papers, [conf(85)]);
    expect(h.trend).toBe("up");
    expect(h.band).toBe("strong");
    expect(h.score).toBeGreaterThanOrEqual(75);
  });

  it("drifting subject: low scores trending down", () => {
    const papers = [
      makePaper({ scored: 55, total: 100, taken_on: "2026-05-01" }),
      makePaper({ scored: 40, total: 100, taken_on: "2026-05-20" }),
      makePaper({ scored: 28, total: 100, taken_on: "2026-06-05" }),
    ];
    const h = subjectHealth(papers, [conf(30)]);
    expect(h.trend).toBe("down");
    expect(h.band === "drifting" || h.band === "watch").toBe(true);
  });

  it("confidence-only still produces a score", () => {
    const h = subjectHealth([], [conf(70)]);
    expect(h.score).toBe(70);
    expect(h.band).toBe("steady");
  });

  it("is deterministic", () => {
    const papers = [makePaper({ scored: 70, total: 100, taken_on: "2026-06-01" })];
    expect(subjectHealth(papers, [conf(60)])).toEqual(
      subjectHealth(papers, [conf(60)]),
    );
  });
});
