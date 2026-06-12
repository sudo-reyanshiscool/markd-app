import { isoDate } from "./dates";

/**
 * Natural-language quick-add parser (spec §7.3).
 *
 * `"essay english fri 5pm 2h !"` →
 *   text "essay", subject English, due next Friday, 17:00, 120 min, priority 4.
 *
 * Pure + deterministic: everything date-relative resolves against the
 * injected `now`. Unmatched words stay in `text`.
 */

export interface ParserSubject {
  id: string;
  name: string;
}

export interface ParsedTask {
  text: string;
  subjectId: string | null;
  /** yyyy-mm-dd */
  dueDate: string | null;
  /** Minutes since midnight; informational (tasks store dates only). */
  dueTimeMinutes: number | null;
  estimateMinutes: number | null;
  /** 1 (low) … 5 (top). Null when no marker present. */
  priority: number | null;
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

interface Span {
  start: number;
  end: number;
}

function nextWeekday(now: Date, target: number, forceNextWeek: boolean): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let diff = (target - d.getDay() + 7) % 7; // 0 = today
  if (forceNextWeek) diff += diff === 0 ? 7 : 7 - (diff > 0 ? 0 : 0);
  d.setDate(d.getDate() + diff);
  return d;
}

function clampYear(d: Date, now: Date): Date {
  // explicit day/month with no year: use this year, roll to next if passed
  if (d.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d;
}

export function parseTaskInput(
  input: string,
  subjects: ParserSubject[],
  now: Date = new Date(),
): ParsedTask {
  const original = input;
  const lower = input.toLowerCase();
  const consumed: Span[] = [];
  const take = (start: number, length: number) =>
    consumed.push({ start, end: start + length });

  let dueDate: string | null = null;
  let dueTimeMinutes: number | null = null;
  let estimateMinutes: number | null = null;
  let priority: number | null = null;
  let subjectId: string | null = null;

  // ---- priority: !, !!, !!! or p1..p5 (word-bounded)
  const bang = /(?:^|\s)(!{1,3})(?=\s|$)/.exec(lower);
  if (bang && bang[1]) {
    priority = Math.min(3 + bang[1].length, 5); // ! → 4, !! → 5, !!! → 5
    take(bang.index + (bang[0].length - bang[1].length), bang[1].length);
  }
  const pNum = /(?:^|\s)p([1-5])(?=\s|$)/.exec(lower);
  if (pNum && pNum[1]) {
    priority = Number(pNum[1]);
    take(pNum.index + (pNum[0].length - pNum[1].length - 1), pNum[1].length + 1);
  }

  // ---- duration: 1h30m / 2h / 90m / 45 min(s)
  const dur =
    /(?:^|\s)(?:(\d{1,2})\s*h(?:ours?|rs?)?(?:\s*(\d{1,2})\s*m(?:ins?)?)?|(\d{1,3})\s*m(?:ins?|inutes?)?)(?=\s|$)/.exec(
      lower,
    );
  if (dur) {
    if (dur[1]) {
      estimateMinutes = Number(dur[1]) * 60 + (dur[2] ? Number(dur[2]) : 0);
    } else if (dur[3]) {
      estimateMinutes = Number(dur[3]);
    }
    const matchStart = dur.index + (dur[0].startsWith(" ") ? 1 : 0);
    take(matchStart, dur[0].trim().length);
  }

  // ---- time: 5pm / 5.30pm / 17:00 / 9am
  const time =
    /(?:^|\s)(?:(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)|([01]?\d|2[0-3]):([0-5]\d))(?=\s|$)/.exec(
      lower,
    );
  if (time) {
    if (time[3]) {
      let h = Number(time[1]);
      const m = time[2] ? Number(time[2]) : 0;
      if (time[3] === "pm" && h < 12) h += 12;
      if (time[3] === "am" && h === 12) h = 0;
      dueTimeMinutes = h * 60 + m;
    } else if (time[4] !== undefined && time[5] !== undefined) {
      dueTimeMinutes = Number(time[4]) * 60 + Number(time[5]);
    }
    const matchStart = time.index + (time[0].startsWith(" ") ? 1 : 0);
    take(matchStart, time[0].trim().length);
  }

  // ---- relative + weekday dates
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateWord =
    /(?:^|\s)(today|tonight|tomorrow|tmrw|next week|next\s+(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|sday|nesday|rsday|urday)?|(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|sday|nesday|rsday|urday)?)(?=\s|$)/.exec(
      lower,
    );
  if (dateWord && dateWord[1]) {
    const word = dateWord[1];
    let resolved: Date | null = null;
    if (word === "today" || word === "tonight") {
      resolved = today;
      if (word === "tonight" && dueTimeMinutes === null) dueTimeMinutes = 19 * 60;
    } else if (word === "tomorrow" || word === "tmrw") {
      resolved = new Date(today);
      resolved.setDate(resolved.getDate() + 1);
    } else if (word === "next week") {
      resolved = nextWeekday(today, 1, false);
      if (isoDate(resolved) === isoDate(today)) resolved.setDate(resolved.getDate() + 7);
      else if (resolved.getTime() <= today.getTime()) resolved.setDate(resolved.getDate() + 7);
      // "next week" from any day = the coming Monday strictly after today
      if (resolved.getTime() - today.getTime() < 86_400_000) {
        resolved.setDate(resolved.getDate() + 7);
      }
    } else if (word.startsWith("next") && dateWord[2]) {
      const target = WEEKDAYS[dateWord[2]];
      if (target !== undefined) {
        resolved = nextWeekday(today, target, false);
        resolved.setDate(resolved.getDate() + 7); // strictly next week's
      }
    } else if (dateWord[3]) {
      const target = WEEKDAYS[dateWord[3]];
      if (target !== undefined) resolved = nextWeekday(today, target, false);
    }
    if (resolved) {
      dueDate = isoDate(resolved);
      const matchStart = dateWord.index + (dateWord[0].startsWith(" ") ? 1 : 0);
      take(matchStart, dateWord[0].trim().length);
    }
  }

  // ---- explicit dates: 2026-06-12 | 12/6 | 12-6 | 12 jun | jun 12
  if (!dueDate) {
    const isoM = /(?:^|\s)(\d{4})-(\d{2})-(\d{2})(?=\s|$)/.exec(lower);
    const dmM = /(?:^|\s)(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?(?=\s|$)/.exec(lower);
    const wordM =
      /(?:^|\s)(?:(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*|(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?)(?=\s|$)/.exec(
        lower,
      );
    if (isoM && isoM[1] && isoM[2] && isoM[3]) {
      const d = new Date(Number(isoM[1]), Number(isoM[2]) - 1, Number(isoM[3]));
      dueDate = isoDate(d);
      take(isoM.index + (isoM[0].startsWith(" ") ? 1 : 0), isoM[0].trim().length);
    } else if (wordM) {
      const day = Number(wordM[1] ?? wordM[4]);
      const monthKey = (wordM[2] ?? wordM[3]) as string;
      const month = MONTHS[monthKey.slice(0, monthKey === "sept" ? 4 : 3)];
      if (month !== undefined && day >= 1 && day <= 31) {
        const d = clampYear(new Date(now.getFullYear(), month, day), now);
        dueDate = isoDate(d);
        take(wordM.index + (wordM[0].startsWith(" ") ? 1 : 0), wordM[0].trim().length);
      }
    } else if (dmM && dmM[1] && dmM[2]) {
      // day/month (UK ordering)
      const day = Number(dmM[1]);
      const month = Number(dmM[2]) - 1;
      const year = dmM[3]
        ? Number(dmM[3].length === 2 ? `20${dmM[3]}` : dmM[3])
        : null;
      if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
        const d = year
          ? new Date(year, month, day)
          : clampYear(new Date(now.getFullYear(), month, day), now);
        dueDate = isoDate(d);
        take(dmM.index + (dmM[0].startsWith(" ") ? 1 : 0), dmM[0].trim().length);
      }
    }
  }

  // ---- subject: longest whole-phrase match, else unique word-prefix match
  const sorted = [...subjects].sort((a, b) => b.name.length - a.name.length);
  for (const s of sorted) {
    const name = s.name.toLowerCase().trim();
    if (!name) continue;
    const idx = lower.indexOf(name);
    const boundedStart = idx === 0 || (idx > 0 && /\s/.test(lower[idx - 1] ?? ""));
    const after = lower[idx + name.length];
    const boundedEnd = after === undefined || /\s/.test(after);
    if (idx >= 0 && boundedStart && boundedEnd) {
      const overlaps = consumed.some((c) => idx < c.end && idx + name.length > c.start);
      if (!overlaps) {
        subjectId = s.id;
        take(idx, name.length);
        break;
      }
    }
  }
  if (!subjectId) {
    // unique first-word prefix: "english" → "English Literature"
    const words = lower.split(/\s+/).filter((w) => w.length >= 4);
    for (const w of words) {
      const hits = subjects.filter((s) =>
        s.name.toLowerCase().split(/\s+/)[0]?.startsWith(w),
      );
      if (hits.length === 1 && hits[0]) {
        const idx = lower.indexOf(w);
        const overlaps = consumed.some((c) => idx < c.end && idx + w.length > c.start);
        if (!overlaps) {
          subjectId = hits[0].id;
          take(idx, w.length);
          break;
        }
      }
    }
  }

  // ---- remaining text
  const keep: boolean[] = Array.from({ length: original.length }, () => true);
  for (const span of consumed) {
    for (let i = span.start; i < span.end && i < keep.length; i++) keep[i] = false;
  }
  const text = original
    .split("")
    .filter((_, i) => keep[i])
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  return { text, subjectId, dueDate, dueTimeMinutes, estimateMinutes, priority };
}
