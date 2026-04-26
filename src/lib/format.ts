const dayMs = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date | string): Date {
  const x = typeof d === "string" ? new Date(d) : new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysUntil(iso: string | undefined): number | null {
  if (!iso) return null;
  const target = startOfDay(iso).getTime();
  const today = startOfDay(new Date()).getTime();
  return Math.round((target - today) / dayMs);
}

export function relativeDay(iso: string | undefined): string {
  const d = daysUntil(iso);
  if (d === null) return "—";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d > 1 && d < 7) return `In ${d}d`;
  if (d < 0 && d > -7) return `${-d}d ago`;
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function shortDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function fmtMinutes(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
