import { Task } from "@/db/schemas";

/** Fixed reference time for deterministic tests: Thursday 2026-06-11 10:00 local. */
export const NOW = new Date(2026, 5, 11, 10, 0, 0);

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? `t-${Math.random().toString(36).slice(2, 8)}`,
    user_id: "u1",
    subject_id: null,
    text: "task",
    done: false,
    priority: 3,
    estimate_minutes: null,
    topic: null,
    due_date: null,
    recurrence: null,
    snoozed_until: null,
    created_at: "2026-06-01T09:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}
