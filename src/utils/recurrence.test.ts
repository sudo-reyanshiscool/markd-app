import { describe, expect, it } from "vitest";

import { nextOccurrence } from "./recurrence";

describe("nextOccurrence", () => {
  it("daily advances by interval", () => {
    expect(nextOccurrence({ freq: "daily", interval: 1 }, "2026-06-11")).toBe(
      "2026-06-12",
    );
    expect(nextOccurrence({ freq: "daily", interval: 3 }, "2026-06-11")).toBe(
      "2026-06-14",
    );
  });

  it("weekly without pinned days repeats the same weekday", () => {
    // 2026-06-11 is a Thursday → next Thursday
    expect(nextOccurrence({ freq: "weekly", interval: 1 }, "2026-06-11")).toBe(
      "2026-06-18",
    );
  });

  it("weekly with pinned weekdays jumps to the next pinned day", () => {
    // Mon(1) + Fri(5); from Thu 11 Jun → Fri 12 Jun
    expect(
      nextOccurrence({ freq: "weekly", interval: 1, byweekday: [1, 5] }, "2026-06-11"),
    ).toBe("2026-06-12");
    // from Fri 12 Jun → Mon 15 Jun
    expect(
      nextOccurrence({ freq: "weekly", interval: 1, byweekday: [1, 5] }, "2026-06-12"),
    ).toBe("2026-06-15");
  });

  it("monthly keeps day-of-month and clamps to month end", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 1 }, "2026-01-31")).toBe(
      "2026-02-28",
    );
    expect(nextOccurrence({ freq: "monthly", interval: 1 }, "2026-06-15")).toBe(
      "2026-07-15",
    );
  });

  it("monthly across year boundary", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 2 }, "2026-12-10")).toBe(
      "2027-02-10",
    );
  });
});
