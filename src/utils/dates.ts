/**
 * Date helpers. All functions are pure; anything "now"-relative takes an
 * optional `now` so tests stay deterministic. Dates-as-data are ISO
 * `yyyy-mm-dd` strings interpreted in the device's local timezone.
 */

export const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export const MONTH_NAMES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** Local-time ISO date (yyyy-mm-dd) for a Date. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse yyyy-mm-dd to a local-midnight Date. Returns null when invalid. */
export function parseISODate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null; // e.g. 2026-02-31
  }
  return d;
}

export function todayISO(now: Date = new Date()): string {
  return isoDate(now);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** Whole days from `fromIso` to `toIso` (positive when `toIso` is later). */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = parseISODate(fromIso);
  const b = parseISODate(toIso);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Monday of the week containing `iso`. */
export function startOfWeekISO(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return isoDate(d);
}

/** "THU 12 JUN" */
export function formatDateShort(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  const dayName = DAY_NAMES[d.getDay()] ?? "";
  const monthName = MONTH_NAMES[d.getMonth()] ?? "";
  return `${dayName} ${d.getDate()} ${monthName}`;
}

/** "12 Jun 2026" */
export function formatDateLong(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  const month = MONTH_NAMES[d.getMonth()] ?? "";
  const title = month.charAt(0) + month.slice(1).toLowerCase();
  return `${d.getDate()} ${title} ${d.getFullYear()}`;
}

export type RelativeDay =
  | { kind: "overdue"; days: number }
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "soon"; days: number } // within 7 days
  | { kind: "later"; days: number };

/** Bucket an ISO date relative to now — drives urgency UI + ranking. */
export function relativeDay(iso: string, now: Date = new Date()): RelativeDay {
  const days = daysBetween(todayISO(now), iso);
  if (days < 0) return { kind: "overdue", days: -days };
  if (days === 0) return { kind: "today" };
  if (days === 1) return { kind: "tomorrow" };
  if (days <= 7) return { kind: "soon", days };
  return { kind: "later", days };
}

/** "14:05" for a minutes-since-midnight value. */
export function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${pad(h)}:${pad(m)}`;
}

/** "1h 30m" / "45m" duration label. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** ISO date for `n` days ago (inclusive helpers for streak math). */
export function daysAgoISO(n: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

/** Local ISO timestamp helpers. */
export function nowISO(now: Date = new Date()): string {
  return now.toISOString();
}

/** The ISO date a timestamp falls on, in local time. */
export function timestampToLocalISODate(ts: string): string {
  return isoDate(new Date(ts));
}
