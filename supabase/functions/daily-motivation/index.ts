// POST /functions/v1/daily-motivation
//
// Two invocation modes:
//   1. CRON (batch): header `x-cron-secret` must equal env CRON_SECRET. Generates a
//      one-liner for every user active in the last 14 days (completed a task, logged
//      a study session, or sent an AI message). Note: the platform's JWT gate still
//      requires an Authorization header — schedulers should send the service-role key
//      as the Bearer token alongside x-cron-secret (see SETUP.md).
//   2. USER (testing/backfill): a normal Supabase JWT generates/returns today's line
//      for that user only.
//
// Per user: streak (consecutive days ending today/yesterday with a completed task or
// study session) + next exam → one Haiku line <= 140 chars, encouraging, dry-witty,
// no hashtags → upsert into daily_motivations (user_id, date) ON CONFLICT DO NOTHING.
// Batch work runs in concurrency-capped groups of 5.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  errorResponse,
  json,
  methodNotAllowed,
  preflight,
} from "../_shared/cors.ts";
import { createServiceClient, requireUser } from "../_shared/auth.ts";
import { enforceRateLimit } from "../_shared/ratelimit.ts";
import { AnthropicError, createMessage, getModel } from "../_shared/anthropic.ts";
import { timingSafeEqualStr } from "../_shared/secure.ts";
import { computeStreakDays, todayUtc } from "../_shared/stats.ts";

const ACTIVE_WINDOW_DAYS = 14;
const BATCH_SIZE = 5;
const MAX_LINE_CHARS = 140;

interface NextExam {
  name: string;
  date: string;
}

async function getNextExam(client: SupabaseClient, userId: string): Promise<NextExam | null> {
  const { data } = await client
    .from("exams")
    .select("name,date")
    .eq("user_id", userId)
    .gte("date", todayUtc())
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as NextExam | null) ?? null;
}

function daysUntil(dateStr: string): number {
  const target = Date.parse(`${dateStr}T00:00:00Z`);
  const today = Date.parse(`${todayUtc()}T00:00:00Z`);
  return Math.max(0, Math.round((target - today) / 86_400_000));
}

/** One short motivational line via Haiku. Returns null when generation fails. */
async function generateLine(streak: number, exam: NextExam | null): Promise<string | null> {
  const facts = [
    `Current streak: ${streak} day${streak === 1 ? "" : "s"}.`,
    exam
      ? `Next exam: ${exam.name} on ${exam.date} (${daysUntil(exam.date)} days away).`
      : "No upcoming exam scheduled.",
  ].join(" ");

  try {
    const response = await createMessage({
      model: getModel("haiku"),
      max_tokens: 100,
      temperature: 1,
      system: [
        {
          type: "text",
          text:
            "You write the single daily motivation line shown on the home screen of Markd, a study " +
            "app for secondary-school students. Reply with EXACTLY one line of plain text, at most " +
            "140 characters. Tone: encouraging with a dry wit — warm, never cheesy, never preachy. " +
            "No hashtags, no quotation marks around the line, no emoji spam, no preamble. " +
            "Use the streak/exam facts naturally when they help; ignore them when they don't.",
          // Static block — flagged for prompt caching across the nightly batch.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: facts }],
    });

    let line = "";
    for (const block of response.content) {
      if (block.type === "text") line += block.text;
    }
    line = line.replace(/\s+/g, " ").replace(/^["'\s]+|["'\s]+$/g, "").replaceAll("#", "").trim();
    if (!line) return null;
    return line.length > MAX_LINE_CHARS ? `${line.slice(0, MAX_LINE_CHARS - 1)}…` : line;
  } catch (err) {
    if (err instanceof AnthropicError) {
      console.error(`daily-motivation upstream status=${err.status} type=${err.errorType}`);
    } else {
      console.error("daily-motivation generation failed:", (err as Error)?.name ?? "unknown");
    }
    return null;
  }
}

/** Generates + upserts today's line for one user. Returns the outcome kind. */
async function processUser(
  service: SupabaseClient,
  userId: string,
  date: string,
): Promise<"generated" | "skipped" | "failed"> {
  // Cheap existence check first — never spend AI tokens on an already-generated day.
  const { data: existing } = await service
    .from("daily_motivations")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (existing) return "skipped";

  const [streak, exam] = await Promise.all([
    computeStreakDays(service, userId),
    getNextExam(service, userId),
  ]);
  const line = await generateLine(streak, exam);
  if (!line) return "failed";

  const { error } = await service.from("daily_motivations").upsert(
    { user_id: userId, date, text: line, model: getModel("haiku") },
    { onConflict: "user_id,date", ignoreDuplicates: true },
  );
  if (error) {
    console.error(`daily-motivation upsert failed code=${error.code ?? "unknown"}`);
    return "failed";
  }
  return "generated";
}

/** Users with any qualifying activity in the last N days. */
async function getActiveUserIds(service: SupabaseClient): Promise<string[]> {
  const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000).toISOString();
  const ids = new Set<string>();
  const sources: Array<{ table: string; column: string }> = [
    { table: "tasks", column: "completed_at" },
    { table: "study_sessions", column: "completed_at" },
    { table: "ai_messages", column: "created_at" },
  ];
  for (const source of sources) {
    const { data, error } = await service
      .from(source.table)
      .select("user_id")
      .gte(source.column, since)
      .limit(10_000);
    if (error) {
      console.error(`daily-motivation activity scan failed table=${source.table}`);
      continue;
    }
    for (const row of (data ?? []) as Array<{ user_id: string }>) {
      if (row.user_id) ids.add(row.user_id);
    }
  }
  return Array.from(ids);
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed();

  const date = todayUtc();
  const service = createServiceClient();

  // --- Mode 1: cron batch -------------------------------------------------
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  if (providedSecret !== null) {
    if (!cronSecret || !timingSafeEqualStr(providedSecret, cronSecret)) {
      return errorResponse("forbidden", "Invalid cron secret.", 403);
    }

    const userIds = await getActiveUserIds(service);
    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const outcomes = await Promise.allSettled(
        batch.map((userId) => processUser(service, userId, date)),
      );
      for (const outcome of outcomes) {
        if (outcome.status === "fulfilled") {
          if (outcome.value === "generated") generated++;
          else if (outcome.value === "skipped") skipped++;
          else failed++;
        } else {
          failed++;
        }
      }
    }

    return json({ date, active_users: userIds.length, generated, skipped, failed });
  }

  // --- Mode 2: single user via JWT (testing / on-demand backfill) ----------
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  // Light limit: regeneration attempts are cheap to deny, AI calls are not.
  const limited = await enforceRateLimit(user.id, "daily-motivation", 6, 3600, service);
  if (limited) return limited;

  const outcome = await processUser(service, user.id, date);
  if (outcome === "failed") {
    return errorResponse(
      "ai_unavailable",
      "Could not generate today's motivation. Please try again shortly.",
      502,
    );
  }

  const { data: row } = await service
    .from("daily_motivations")
    .select("date,text,model")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();
  return json({ motivation: row ?? null, generated: outcome === "generated" });
});
