import { Recurrence } from "@/db/schemas";

import { addDays, parseISODate, isoDate } from "./dates";

/**
 * rrule-lite (spec §7.3): completing a recurring task spawns the next
 * occurrence. Supported: daily/weekly/monthly with interval; weekly may pin
 * specific weekdays.
 */
export function nextOccurrence(rec: Recurrence, fromISO: string): string {
  const interval = rec.interval ?? 1;

  if (rec.freq === "daily") {
    return addDays(fromISO, interval);
  }

  if (rec.freq === "weekly") {
    const from = parseISODate(fromISO);
    if (!from) return fromISO;
    const days = (rec.byweekday ?? [from.getDay()])
      .slice()
      .sort((a, b) => a - b);
    // nearest pinned weekday strictly after `from`
    for (let offset = 1; offset <= 7; offset++) {
      const candidate = new Date(from);
      candidate.setDate(candidate.getDate() + offset);
      if (days.includes(candidate.getDay())) {
        // apply interval: when the next pinned day wraps to a new week,
        // jump (interval-1) extra weeks
        const wrapped = candidate.getDay() <= from.getDay();
        if (interval > 1 && wrapped) {
          candidate.setDate(candidate.getDate() + (interval - 1) * 7);
        }
        return isoDate(candidate);
      }
    }
    return addDays(fromISO, 7 * interval);
  }

  // monthly: same day-of-month next interval months, clamped to month end
  const from = parseISODate(fromISO);
  if (!from) return fromISO;
  const targetMonth = from.getMonth() + interval;
  const year = from.getFullYear() + Math.floor(targetMonth / 12);
  const month = targetMonth % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(from.getDate(), lastDay);
  return isoDate(new Date(year, month, day));
}
