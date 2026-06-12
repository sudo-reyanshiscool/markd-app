import { describe, expect, it } from "vitest";

import { parseTaskInput, ParserSubject } from "./taskParser";
import { NOW } from "./__tests__helpers";

// NOW = Thursday 11 June 2026
const subjects: ParserSubject[] = [
  { id: "s-eng", name: "English Literature" },
  { id: "s-math", name: "Maths" },
  { id: "s-hist", name: "History" },
];

describe("parseTaskInput", () => {
  it("parses the spec example: essay english fri 5pm 2h !", () => {
    const r = parseTaskInput("essay english fri 5pm 2h !", subjects, NOW);
    expect(r.text).toBe("essay");
    expect(r.subjectId).toBe("s-eng"); // unique prefix → English Literature
    expect(r.dueDate).toBe("2026-06-12"); // upcoming Friday
    expect(r.dueTimeMinutes).toBe(17 * 60);
    expect(r.estimateMinutes).toBe(120);
    expect(r.priority).toBe(4); // single !
  });

  it("keeps unmatched words in text", () => {
    const r = parseTaskInput("revise quadratic equations", subjects, NOW);
    expect(r.text).toBe("revise quadratic equations");
    expect(r.subjectId).toBeNull();
    expect(r.dueDate).toBeNull();
  });

  it("matches a full subject name case-insensitively", () => {
    const r = parseTaskInput("notes english literature tomorrow", subjects, NOW);
    expect(r.subjectId).toBe("s-eng");
    expect(r.dueDate).toBe("2026-06-12");
    expect(r.text).toBe("notes");
  });

  it("understands today / tonight / tomorrow", () => {
    expect(parseTaskInput("x today", subjects, NOW).dueDate).toBe("2026-06-11");
    expect(parseTaskInput("x tomorrow", subjects, NOW).dueDate).toBe("2026-06-12");
    const tonight = parseTaskInput("x tonight", subjects, NOW);
    expect(tonight.dueDate).toBe("2026-06-11");
    expect(tonight.dueTimeMinutes).toBe(19 * 60);
  });

  it("weekday on the same weekday means today", () => {
    expect(parseTaskInput("x thu", subjects, NOW).dueDate).toBe("2026-06-11");
  });

  it("next <weekday> jumps a week", () => {
    // next fri from Thu 11 Jun → Fri 19 Jun (strictly next week's Friday)
    expect(parseTaskInput("x next fri", subjects, NOW).dueDate).toBe("2026-06-19");
  });

  it("next week resolves to the coming Monday", () => {
    expect(parseTaskInput("x next week", subjects, NOW).dueDate).toBe("2026-06-15");
  });

  it("parses explicit dates: iso, d/m, '12 jun', 'jun 12'", () => {
    expect(parseTaskInput("x 2026-07-01", subjects, NOW).dueDate).toBe("2026-07-01");
    expect(parseTaskInput("x 1/7", subjects, NOW).dueDate).toBe("2026-07-01");
    expect(parseTaskInput("x 12 jun", subjects, NOW).dueDate).toBe("2026-06-12");
    expect(parseTaskInput("x jun 12", subjects, NOW).dueDate).toBe("2026-06-12");
  });

  it("rolls passed day/month dates into next year", () => {
    expect(parseTaskInput("x 3 jan", subjects, NOW).dueDate).toBe("2027-01-03");
  });

  it("parses durations: 2h, 90m, 1h30m", () => {
    expect(parseTaskInput("x 2h", subjects, NOW).estimateMinutes).toBe(120);
    expect(parseTaskInput("x 90m", subjects, NOW).estimateMinutes).toBe(90);
    expect(parseTaskInput("x 1h 30m", subjects, NOW).estimateMinutes).toBe(90);
  });

  it("parses times: 5pm, 17:00, 9.30am", () => {
    expect(parseTaskInput("x 5pm", subjects, NOW).dueTimeMinutes).toBe(17 * 60);
    expect(parseTaskInput("x 17:00", subjects, NOW).dueTimeMinutes).toBe(17 * 60);
    expect(parseTaskInput("x 9.30am", subjects, NOW).dueTimeMinutes).toBe(9 * 60 + 30);
  });

  it("parses priority markers: !, !!, p1..p5", () => {
    expect(parseTaskInput("x !", subjects, NOW).priority).toBe(4);
    expect(parseTaskInput("x !!", subjects, NOW).priority).toBe(5);
    expect(parseTaskInput("x p1", subjects, NOW).priority).toBe(1);
    expect(parseTaskInput("x p5", subjects, NOW).priority).toBe(5);
    expect(parseTaskInput("plain task", subjects, NOW).priority).toBeNull();
  });

  it("is deterministic for the same now", () => {
    const a = parseTaskInput("essay english fri 5pm 2h !", subjects, NOW);
    const b = parseTaskInput("essay english fri 5pm 2h !", subjects, NOW);
    expect(a).toEqual(b);
  });

  it("does not treat words containing weekday substrings as dates", () => {
    const r = parseTaskInput("monitor experiment", subjects, NOW);
    expect(r.dueDate).toBeNull();
    expect(r.text).toBe("monitor experiment");
  });
});
