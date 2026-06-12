import { Paper, StudySession, Task, TopicConfidence } from "@/db/schemas";

import { daysAgoISO, startOfWeekISO, timestampToLocalISODate, todayISO } from "./dates";

/**
 * Streak, XP/levels and subject health (spec §7.1). Pure + deterministic —
 * everything takes `now`.
 */

// ------------------------------------------------------------------ XP
export const XP_RULES = {
  taskDone: 10,
  studyMinute: 1,
  paperLogged: 15,
} as const;

export interface XpInputs {
  tasksCompleted: number;
  studyMinutes: number;
  papersLogged: number;
}

export function totalXp(i: XpInputs): number {
  return (
    i.tasksCompleted * XP_RULES.taskDone +
    Math.round(i.studyMinutes) * XP_RULES.studyMinute +
    i.papersLogged * XP_RULES.paperLogged
  );
}

/** Cumulative XP needed to FINISH level n (triangular curve: 100, 300, 600…). */
export function xpThreshold(level: number): number {
  return 50 * level * (level + 1);
}

export interface LevelInfo {
  level: number;
  /** XP gathered inside the current level. */
  into: number;
  /** XP span of the current level. */
  span: number;
  /** 0..1 progress to the next level. */
  progress: number;
}

export function levelForXp(xp: number): LevelInfo {
  let level = 1;
  while (xpThreshold(level) <= xp) level += 1;
  const prev = xpThreshold(level - 1);
  const span = xpThreshold(level) - prev;
  const into = xp - prev;
  return { level, into, span, progress: span === 0 ? 0 : into / span };
}

// ------------------------------------------------------------------ streak
/**
 * Consecutive days (ending today, or yesterday as grace) with at least one
 * completed task or logged study session.
 */
export function streakDays(
  activityDates: ReadonlySet<string>,
  now: Date = new Date(),
): { days: number; aliveToday: boolean; atRisk: boolean } {
  const today = todayISO(now);
  const yesterday = daysAgoISO(1, now);
  const aliveToday = activityDates.has(today);
  const anchor = aliveToday ? today : activityDates.has(yesterday) ? yesterday : null;
  if (!anchor) return { days: 0, aliveToday: false, atRisk: false };

  let days = 0;
  let offset = anchor === today ? 0 : 1;
  while (activityDates.has(daysAgoISO(offset, now))) {
    days += 1;
    offset += 1;
  }
  return { days, aliveToday, atRisk: !aliveToday && days > 0 };
}

export function activityDateSet(
  tasks: Task[],
  sessions: StudySession[],
): Set<string> {
  const dates = new Set<string>();
  for (const t of tasks) {
    if (t.done && t.completed_at) dates.add(timestampToLocalISODate(t.completed_at));
  }
  for (const s of sessions) {
    dates.add(timestampToLocalISODate(s.completed_at));
  }
  return dates;
}

// ----------------------------------------------------------------- weekly
export interface WeeklySummary {
  tasksDone: number;
  studyMinutes: number;
  papersLogged: number;
}

export function weeklySummary(
  tasks: Task[],
  sessions: StudySession[],
  papers: Paper[],
  now: Date = new Date(),
): WeeklySummary {
  const weekStart = startOfWeekISO(todayISO(now));
  const inWeek = (iso: string) => iso >= weekStart && iso <= todayISO(now);
  return {
    tasksDone: tasks.filter(
      (t) => t.done && t.completed_at && inWeek(timestampToLocalISODate(t.completed_at)),
    ).length,
    studyMinutes: sessions
      .filter((s) => inWeek(timestampToLocalISODate(s.completed_at)))
      .reduce((acc, s) => acc + s.minutes, 0),
    papersLogged: papers.filter(
      (p) =>
        (p.taken_on && inWeek(p.taken_on)) ||
        (!p.taken_on && inWeek(timestampToLocalISODate(p.created_at))),
    ).length,
  };
}

// ----------------------------------------------------------- subject health
export type HealthBand = "strong" | "steady" | "watch" | "drifting" | "none";

export interface SubjectHealth {
  /** 0..100, or null when there is no signal yet. */
  score: number | null;
  band: HealthBand;
  /** Direction of the last few paper scores. */
  trend: "up" | "down" | "flat" | null;
}

/**
 * Health from recent paper percentages (50%), topic confidence (30%) and
 * score momentum (20%).
 */
export function subjectHealth(
  papers: Paper[],
  confidences: TopicConfidence[],
): SubjectHealth {
  const scored = papers
    .filter((p) => p.scored != null && p.total != null && p.total > 0)
    .sort((a, b) =>
      (a.taken_on ?? a.created_at) < (b.taken_on ?? b.created_at) ? -1 : 1,
    );
  const pcts = scored.map((p) => (p.scored! / p.total!) * 100);
  const recent = pcts.slice(-3);
  const avgPaper = recent.length
    ? recent.reduce((a, b) => a + b, 0) / recent.length
    : null;

  const avgConfidence = confidences.length
    ? confidences.reduce((a, c) => a + c.confidence, 0) / confidences.length
    : null;

  let trend: SubjectHealth["trend"] = null;
  if (pcts.length >= 2) {
    const last = pcts[pcts.length - 1]!;
    const prev = pcts[pcts.length - 2]!;
    trend = last - prev > 3 ? "up" : prev - last > 3 ? "down" : "flat";
  }

  if (avgPaper === null && avgConfidence === null) {
    return { score: null, band: "none", trend: null };
  }

  let score = 0;
  let weight = 0;
  if (avgPaper !== null) {
    score += avgPaper * 0.5;
    weight += 0.5;
  }
  if (avgConfidence !== null) {
    score += avgConfidence * 0.3;
    weight += 0.3;
  }
  if (trend !== null) {
    score += (trend === "up" ? 90 : trend === "flat" ? 60 : 25) * 0.2;
    weight += 0.2;
  }
  const final = Math.round(Math.max(0, Math.min(100, score / weight)));

  const band: HealthBand =
    final >= 75 ? "strong" : final >= 55 ? "steady" : final >= 35 ? "watch" : "drifting";
  return { score: final, band, trend };
}
