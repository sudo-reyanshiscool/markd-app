import { describe, expect, it } from "vitest";

import {
  aiBreakdownSchema,
  calendarFeedSchema,
  recurrenceSchema,
  subjectInsertSchema,
  taskInsertSchema,
  taskSchema,
} from "./schemas";

describe("schemas", () => {
  it("subject name must be 1–80 chars", () => {
    expect(subjectInsertSchema.safeParse({ name: "" }).success).toBe(false);
    expect(subjectInsertSchema.safeParse({ name: "x".repeat(81) }).success).toBe(false);
    expect(
      subjectInsertSchema.safeParse({
        name: "Maths",
        board: null,
        target_grade: null,
        color: "volt",
        position: 0,
      }).success,
    ).toBe(true);
  });

  it("task text 1–500, priority 1–5 default 3", () => {
    const base = {
      subject_id: null,
      estimate_minutes: null,
      topic: null,
      due_date: null,
      recurrence: null,
    };
    expect(taskInsertSchema.safeParse({ ...base, text: "" }).success).toBe(false);
    expect(
      taskInsertSchema.safeParse({ ...base, text: "y".repeat(501) }).success,
    ).toBe(false);
    const parsed = taskInsertSchema.parse({ ...base, text: "do thing" });
    expect(parsed.priority).toBe(3);
    expect(
      taskInsertSchema.safeParse({ ...base, text: "x", priority: 6 }).success,
    ).toBe(false);
    expect(
      taskInsertSchema.safeParse({ ...base, text: "x", priority: 0 }).success,
    ).toBe(false);
  });

  it("due_date must be yyyy-mm-dd", () => {
    const row = {
      id: "1",
      user_id: "u",
      subject_id: null,
      text: "x",
      done: false,
      priority: 3,
      estimate_minutes: null,
      topic: null,
      due_date: "12/06/2026",
      recurrence: null,
      snoozed_until: null,
      created_at: "2026-06-11T00:00:00.000Z",
      completed_at: null,
    };
    expect(taskSchema.safeParse(row).success).toBe(false);
    expect(taskSchema.safeParse({ ...row, due_date: "2026-06-12" }).success).toBe(true);
  });

  it("recurrence validates freq + interval bounds", () => {
    expect(recurrenceSchema.safeParse({ freq: "weekly", interval: 1 }).success).toBe(
      true,
    );
    expect(recurrenceSchema.safeParse({ freq: "yearly" }).success).toBe(false);
    expect(
      recurrenceSchema.safeParse({ freq: "daily", interval: 0 }).success,
    ).toBe(false);
    expect(
      recurrenceSchema.safeParse({ freq: "weekly", interval: 1, byweekday: [7] })
        .success,
    ).toBe(false);
  });

  it("calendar feeds must be https", () => {
    const base = {
      id: "1",
      user_id: "u",
      label: null,
      last_synced_at: null,
      last_event_count: null,
      status: "pending",
      last_error: null,
      created_at: "2026-06-11T00:00:00.000Z",
    };
    expect(
      calendarFeedSchema.safeParse({ ...base, url: "http://cal.example/feed.ics" })
        .success,
    ).toBe(false);
    expect(
      calendarFeedSchema.safeParse({ ...base, url: "https://cal.example/feed.ics" })
        .success,
    ).toBe(true);
  });

  it("ai breakdown shape validates and defaults", () => {
    const parsed = aiBreakdownSchema.parse({
      topics: [{ name: "Algebra" }],
    });
    expect(parsed.topics[0]).toEqual({
      name: "Algebra",
      subtopics: [],
      key_skills: [],
      estimated_hours: 0,
    });
    expect(aiBreakdownSchema.safeParse({ topics: "no" }).success).toBe(false);
  });
});
