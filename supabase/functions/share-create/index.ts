// /functions/v1/share-create
//
//   POST   {}              → create a public read-only share link (Pro only).
//                            A user gets at most ONE active link: any previous
//                            active links are revoked (deleted) automatically.
//   DELETE { slug }        → revoke (delete) the caller's link with that slug.
//                            Revocation works on any plan so downgraded users
//                            can still remove an old link.
//
// The link payload is a DENORMALISED SNAPSHOT taken via the user-scoped client:
//   { first_name, subjects: [{name, target_grade}], streak_days, level, xp,
//     upcoming: [{title, date, kind}] (next 5 deadlines/exams),
//     week: { tasks_done, study_minutes } }
// expires_at = now() + 30 days. The public page resolves slugs via the
// `get_share(p_slug)` RPC; this function only writes share_links rows.
//
// XP formula (mirrors the client gamification): 10 XP per completed task +
// 1 XP per study minute; level = floor(sqrt(xp / 100)) + 1.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders,
  errorResponse,
  json,
  methodNotAllowed,
  preflight,
  readJson,
} from "../_shared/cors.ts";
import { createServiceClient, requireUser } from "../_shared/auth.ts";
import { enforceRateLimit } from "../_shared/ratelimit.ts";
import { getPlan, requirePro } from "../_shared/entitlements.ts";
import { randomSlug } from "../_shared/secure.ts";
import { computeStreakDays, startOfWeekUtc, todayUtc } from "../_shared/stats.ts";

const SHARE_TTL_DAYS = 30;
const SLUG_LENGTH = 10;

interface SharePayload {
  first_name: string | null;
  subjects: Array<{ name: string; target_grade: string | null }>;
  streak_days: number;
  level: number;
  xp: number;
  upcoming: Array<{ title: string; date: string; kind: "deadline" | "exam" }>;
  week: { tasks_done: number; study_minutes: number };
}

async function buildPayload(db: SupabaseClient, userId: string): Promise<SharePayload> {
  const today = todayUtc();
  const weekStartIso = startOfWeekUtc().toISOString();

  const [
    profileRes,
    subjectsRes,
    deadlinesRes,
    examsRes,
    completedCountRes,
    weekTasksRes,
    weekSessionsRes,
    allSessionsRes,
    streakDays,
  ] = await Promise.all([
    db.from("profiles").select("name").maybeSingle(),
    db
      .from("subjects")
      .select("name,target_grade")
      .is("archived_at", null)
      .order("position", { ascending: true })
      .limit(20),
    db
      .from("deadlines")
      .select("title,date")
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(5),
    db
      .from("exams")
      .select("name,date")
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(5),
    db.from("tasks").select("id", { count: "exact", head: true }).eq("done", true),
    db
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("done", true)
      .gte("completed_at", weekStartIso),
    db
      .from("study_sessions")
      .select("minutes")
      .gte("completed_at", weekStartIso)
      .limit(2000),
    db.from("study_sessions").select("minutes").range(0, 9999),
    computeStreakDays(db, userId),
  ]);

  const firstName =
    (profileRes.data as { name: string | null } | null)?.name?.trim().split(/\s+/)[0] ?? null;

  const subjects = ((subjectsRes.data ?? []) as Array<{ name: string; target_grade: string | null }>)
    .map((s) => ({ name: s.name, target_grade: s.target_grade ?? null }));

  const upcoming = [
    ...((deadlinesRes.data ?? []) as Array<{ title: string; date: string }>).map((d) => ({
      title: d.title,
      date: d.date,
      kind: "deadline" as const,
    })),
    ...((examsRes.data ?? []) as Array<{ name: string; date: string }>).map((e) => ({
      title: e.name,
      date: e.date,
      kind: "exam" as const,
    })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const sumMinutes = (rows: unknown): number =>
    ((rows ?? []) as Array<{ minutes: number | null }>).reduce(
      (total, row) => total + (row.minutes ?? 0),
      0,
    );

  const completedTasks = completedCountRes.count ?? 0;
  const totalStudyMinutes = sumMinutes(allSessionsRes.data);
  const xp = completedTasks * 10 + totalStudyMinutes;
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;

  return {
    first_name: firstName || null,
    subjects,
    streak_days: streakDays,
    level,
    xp,
    upcoming,
    week: {
      tasks_done: weekTasksRes.count ?? 0,
      study_minutes: sumMinutes(weekSessionsRes.data),
    },
  };
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST" && req.method !== "DELETE") return methodNotAllowed();

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user, supabase } = auth;

  const service = createServiceClient();
  const limited = await enforceRateLimit(user.id, "share-create", 10, 3600, service);
  if (limited) return limited;

  // ---- DELETE: revoke a link ------------------------------------------------
  if (req.method === "DELETE") {
    const body = await readJson<{ slug?: unknown }>(req);
    const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
    if (!slug || slug.length > 64) {
      return errorResponse("invalid_request", 'A "slug" string is required.', 400);
    }
    // User-scoped delete — RLS guarantees you can only revoke your own link.
    const { data, error } = await supabase
      .from("share_links")
      .delete()
      .eq("slug", slug)
      .select("id");
    if (error) return errorResponse("internal_error", "Could not revoke the link.", 500);
    if (!data || data.length === 0) {
      return errorResponse("not_found", "No share link with that slug was found.", 404);
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ---- POST: create a link (Pro) ---------------------------------------------
  const plan = await getPlan(service, user.id);
  const gated = requirePro(plan);
  if (gated) return gated;

  let payload: SharePayload;
  try {
    payload = await buildPayload(supabase, user.id);
  } catch {
    return errorResponse("internal_error", "Could not build the share snapshot.", 500);
  }

  // Enforce "max 1 active link": revoke (delete) all existing links first.
  const { error: revokeError } = await supabase
    .from("share_links")
    .delete()
    .eq("user_id", user.id);
  if (revokeError) {
    return errorResponse("internal_error", "Could not replace the existing link.", 500);
  }

  const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 86_400_000).toISOString();

  // Slug collisions are ~impossible (64^10) but retry once for completeness.
  for (let attempt = 0; attempt < 2; attempt++) {
    const slug = randomSlug(SLUG_LENGTH);
    const { error } = await supabase.from("share_links").insert({
      user_id: user.id,
      slug,
      payload,
      expires_at: expiresAt,
    });
    if (!error) {
      const base = (Deno.env.get("APP_WEB_URL") ?? "").replace(/\/$/, "");
      return json({ slug, url: `${base}/share/${slug}`, expires_at: expiresAt }, 201);
    }
    if (error.code !== "23505") {
      // Not a unique violation — give up.
      return errorResponse("internal_error", "Could not create the share link.", 500);
    }
  }
  return errorResponse("internal_error", "Could not create the share link.", 500);
});
