import type { AppData, Exam, Subject, Task } from "./types";
import { daysUntil } from "./format";

export const PRIORITY_WEIGHT = { urgent: 0, soon: 1, later: 2 } as const;
export const XP_PER_LEVEL = 120;
export const DAILY_PLANNER_LIMIT = 6;

export function plannerOrder(tasks: Task[]): Task[] {
  const open = tasks.filter((t) => !t.done);
  return [...open].sort((a, b) => {
    const dA = daysUntil(a.due) ?? 999;
    const dB = daysUntil(b.due) ?? 999;
    if (dA !== dB) return dA - dB;
    if (PRIORITY_WEIGHT[a.priority] !== PRIORITY_WEIGHT[b.priority]) {
      return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    }
    return (a.estimateMin ?? 30) - (b.estimateMin ?? 30);
  });
}

export function pickDoNext(tasks: Task[]): Task | null {
  const ranked = plannerOrder(tasks);
  return ranked[0] ?? null;
}

export function nextExam(exams: Exam[]): Exam | null {
  const upcoming = exams
    .filter((e) => (daysUntil(e.date) ?? -1) >= 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return upcoming[0] ?? null;
}

export interface SubjectHealth {
  score: number;          // 0–100
  label: "On track" | "Needs care" | "At risk" | "Quiet";
  taskLoad: number;
  examPressure: number;
}

export function subjectHealth(subject: Subject, data: AppData): SubjectHealth {
  const tasks = data.tasks.filter((t) => t.subjectId === subject.id);
  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => (daysUntil(t.due) ?? 999) < 0);
  const upcomingExam = data.exams
    .filter((e) => e.subjectId === subject.id)
    .map((e) => daysUntil(e.date) ?? 999)
    .filter((d) => d >= 0)
    .sort((a, b) => a - b)[0];

  let score = 100;
  score -= overdue.length * 18;
  score -= Math.max(0, open.length - 3) * 4;
  if (upcomingExam !== undefined) {
    if (upcomingExam <= 7) score -= 28;
    else if (upcomingExam <= 21) score -= 14;
    else if (upcomingExam <= 60) score -= 6;
  }
  score = Math.max(0, Math.min(100, score));

  let label: SubjectHealth["label"] = "On track";
  if (tasks.length === 0 && upcomingExam === undefined) label = "Quiet";
  else if (score < 45) label = "At risk";
  else if (score < 75) label = "Needs care";

  return {
    score,
    label,
    taskLoad: open.length,
    examPressure: upcomingExam ?? -1,
  };
}

export function totalXP(data: AppData): number {
  const taskXp = data.tasks.filter((t) => t.done).length * 8;
  const sessionXp = data.studySessions.reduce((acc, s) => acc + Math.min(60, s.minutes), 0);
  return taskXp + sessionXp;
}

export function levelFromXp(xp: number): { level: number; pct: number; into: number } {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const into = xp % XP_PER_LEVEL;
  return { level, pct: (into / XP_PER_LEVEL) * 100, into };
}
