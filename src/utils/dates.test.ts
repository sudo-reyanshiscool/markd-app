import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  formatDateLong,
  formatDateShort,
  formatDuration,
  isoDate,
  parseISODate,
  relativeDay,
  startOfWeekISO,
  todayISO,
} from "./dates";
import { NOW } from "./__tests__helpers";

describe("dates", () => {
  it("isoDate uses local time", () => {
    expect(isoDate(new Date(2026, 5, 11, 23, 59))).toBe("2026-06-11");
    expect(isoDate(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });

  it("parseISODate round-trips and rejects junk", () => {
    expect(isoDate(parseISODate("2026-06-11")!)).toBe("2026-06-11");
    expect(parseISODate("2026-02-31")).toBeNull();
    expect(parseISODate("nope")).toBeNull();
    expect(parseISODate(null)).toBeNull();
  });

  it("addDays and daysBetween agree", () => {
    expect(addDays("2026-06-11", 4)).toBe("2026-06-15");
    expect(addDays("2026-06-11", -11)).toBe("2026-05-31");
    expect(daysBetween("2026-06-11", "2026-06-15")).toBe(4);
    expect(daysBetween("2026-06-15", "2026-06-11")).toBe(-4);
  });

  it("startOfWeekISO returns Monday", () => {
    expect(startOfWeekISO("2026-06-11")).toBe("2026-06-08"); // Thu → Mon
    expect(startOfWeekISO("2026-06-08")).toBe("2026-06-08"); // Mon → itself
    expect(startOfWeekISO("2026-06-14")).toBe("2026-06-08"); // Sun → prev Mon
  });

  it("formats dates", () => {
    expect(formatDateShort("2026-06-11")).toBe("THU 11 JUN");
    expect(formatDateLong("2026-06-11")).toBe("11 Jun 2026");
  });

  it("relativeDay buckets correctly", () => {
    expect(relativeDay("2026-06-09", NOW)).toEqual({ kind: "overdue", days: 2 });
    expect(relativeDay("2026-06-11", NOW)).toEqual({ kind: "today" });
    expect(relativeDay("2026-06-12", NOW)).toEqual({ kind: "tomorrow" });
    expect(relativeDay("2026-06-15", NOW)).toEqual({ kind: "soon", days: 4 });
    expect(relativeDay("2026-08-01", NOW)).toEqual({ kind: "later", days: 51 });
  });

  it("formatDuration", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(0)).toBe("0m");
  });

  it("todayISO uses provided now", () => {
    expect(todayISO(NOW)).toBe("2026-06-11");
  });
});
