// Cross-function user stats helpers (streak, week window, day keys).
// Used by daily-motivation and share-create. All dates are computed in UTC.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const DAY_MS = 86_400_000;

/** YYYY-MM-DD (UTC) for a Date. */
export function dayKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD (UTC). */
export function todayUtc(): string {
  return dayKeyUtc(new Date());
}

/** Start of the current ISO week (Monday 00:00 UTC). */
export function startOfWeekUtc(now = new Date()): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  return new Date(start.getTime() - daysSinceMonday * DAY_MS);
}

/**
 * Streak = consecutive days (ending today or yesterday) with at least one
 * completed task or logged study session. Looks back up to 120 days.
 *
 * Works with either the user-scoped client (RLS) or the service client —
 * the explicit `user_id` filter keeps both correct.
 */
export async function computeStreakDays(
  client: SupabaseClient,
  userId: string,
): Promise<number> {
  const since = new Date(Date.now() - 120 * DAY_MS).toISOString();
  const [tasksRes, sessionsRes] = await Promise.all([
    client
      .from("tasks")
      .select("completed_at")
      .eq("user_id", userId)
      .eq("done", true)
      .not("completed_at", "is", null)
      .gte("completed_at", since)
      .limit(5000),
    client
      .from("study_sessions")
      .select("completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .gte("completed_at", since)
      .limit(5000),
  ]);

  const activeDays = new Set<string>();
  for (const row of (tasksRes.data ?? []) as Array<{ completed_at: string | null }>) {
    if (row.completed_at) activeDays.add(row.completed_at.slice(0, 10));
  }
  for (const row of (sessionsRes.data ?? []) as Array<{ completed_at: string | null }>) {
    if (row.completed_at) activeDays.add(row.completed_at.slice(0, 10));
  }
  if (activeDays.size === 0) return 0;

  // A streak is alive if it includes today, or ended yesterday (today still pending).
  const now = new Date();
  let cursor = activeDays.has(dayKeyUtc(now)) ? now : new Date(now.getTime() - DAY_MS);
  let streak = 0;
  while (activeDays.has(dayKeyUtc(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}
