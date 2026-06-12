import { Task } from "@/db/schemas";

import { relativeDay } from "./dates";

/**
 * Planner ranking (spec §7.3): deterministic score combining due-date
 * urgency, explicit priority (5 = top) and a quick-win nudge for short
 * estimates. Done + snoozed tasks never rank.
 */

export function isActionable(task: Task, now: Date = new Date()): boolean {
  if (task.done) return false;
  if (task.snoozed_until && new Date(task.snoozed_until).getTime() > now.getTime()) {
    return false;
  }
  return true;
}

export function taskScore(task: Task, now: Date = new Date()): number {
  let urgency = 25; // no due date
  if (task.due_date) {
    const rel = relativeDay(task.due_date, now);
    switch (rel.kind) {
      case "overdue":
        urgency = 100 + Math.min(rel.days * 5, 50);
        break;
      case "today":
        urgency = 90;
        break;
      case "tomorrow":
        urgency = 70;
        break;
      case "soon":
        urgency = 60 - rel.days * 5;
        break;
      case "later":
        urgency = Math.max(20 - rel.days * 0.5, 5);
        break;
    }
  }

  const priorityComponent = (task.priority - 3) * 8;

  let quickWin = 0;
  if (task.estimate_minutes != null) {
    if (task.estimate_minutes <= 30) quickWin = 6;
    else if (task.estimate_minutes >= 120) quickWin = -4;
  }

  return urgency + priorityComponent + quickWin;
}

/** Sorted copy, highest score first, stable deterministic tie-breaks. */
export function rankTasks(tasks: Task[], now: Date = new Date()): Task[] {
  return tasks
    .filter((t) => isActionable(t, now))
    .map((t) => ({ t, score: taskScore(t, now) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aDue = a.t.due_date ?? "9999-12-31";
      const bDue = b.t.due_date ?? "9999-12-31";
      if (aDue !== bDue) return aDue < bDue ? -1 : 1;
      if (a.t.priority !== b.t.priority) return b.t.priority - a.t.priority;
      if (a.t.created_at !== b.t.created_at)
        return a.t.created_at < b.t.created_at ? -1 : 1;
      return a.t.id < b.t.id ? -1 : 1;
    })
    .map((x) => x.t);
}

/** The single "Do next" pick for the Home planner card. */
export function doNext(tasks: Task[], now: Date = new Date()): Task | null {
  return rankTasks(tasks, now)[0] ?? null;
}
