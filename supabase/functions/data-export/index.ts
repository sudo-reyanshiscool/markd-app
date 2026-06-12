// POST /functions/v1/data-export
//
// GDPR data export. JWT → rate limit (data-export, 2/day) → gathers every row the
// user owns from all user-owned tables via the USER-SCOPED client (RLS guarantees
// only their data) into data.json, downloads their syllabus files from the
// `syllabi` bucket, and streams back an in-memory zip (npm:fflate):
//
//   markd-export-YYYY-MM-DD.zip
//     ├── data.json              all rows, keyed by table name (+ export metadata)
//     └── files/<file_name>      each uploaded syllabus object
//
// Hard cap: 50 MB of gathered content → 413 { error: { code: "export_too_large" } }.

import { strToU8, zipSync } from "npm:fflate@0.8.2";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders,
  errorResponse,
  methodNotAllowed,
  preflight,
} from "../_shared/cors.ts";
import { createServiceClient, requireUser } from "../_shared/auth.ts";
import { enforceRateLimit } from "../_shared/ratelimit.ts";

const MAX_EXPORT_BYTES = 50 * 1024 * 1024; // 50 MB
const PAGE_SIZE = 1000;
const MAX_PAGES_PER_TABLE = 20; // 20k rows/table guardrail

/** Every user-owned table (spec §4 + calendar_events). RLS scopes all reads. */
const USER_TABLES = [
  "subjects",
  "subject_specs",
  "tasks",
  "deadlines",
  "exams",
  "papers",
  "goals",
  "portfolio_entries",
  "activities",
  "activity_events",
  "topic_confidence",
  "study_sessions",
  "ai_conversations",
  "ai_messages",
  "daily_motivations",
  "calendar_feeds",
  "calendar_events",
  "deletion_log",
  "share_links",
  "device_tokens",
  "subscriptions",
] as const;

async function fetchAllRows(
  db: SupabaseClient,
  table: string,
): Promise<{ rows: unknown[]; truncated: boolean }> {
  const rows: unknown[] = [];
  for (let page = 0; page < MAX_PAGES_PER_TABLE; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await db
      .from(table)
      .select("*")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      // Some tables (e.g. without created_at default ordering) — retry unordered.
      const fallback = await db.from(table).select("*").range(from, from + PAGE_SIZE - 1);
      if (fallback.error) throw new Error(`table:${table}`);
      rows.push(...(fallback.data ?? []));
      if ((fallback.data ?? []).length < PAGE_SIZE) return { rows, truncated: false };
      continue;
    }
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed();

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user, supabase } = auth;

  const service = createServiceClient();
  const limited = await enforceRateLimit(user.id, "data-export", 2, 86_400, service);
  if (limited) return limited;

  // ---- Gather rows ----------------------------------------------------------
  const data: Record<string, unknown> = {};
  const notes: string[] = [];

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) notes.push("profiles: could not be exported");
  else data.profile = profile ?? null;

  for (const table of USER_TABLES) {
    try {
      const { rows, truncated } = await fetchAllRows(supabase, table);
      data[table] = rows;
      if (truncated) notes.push(`${table}: truncated at ${PAGE_SIZE * MAX_PAGES_PER_TABLE} rows`);
    } catch {
      notes.push(`${table}: could not be exported`);
      data[table] = [];
    }
  }

  const exportedAt = new Date().toISOString();
  const dataJson = JSON.stringify(
    {
      export: {
        app: "Markd",
        version: 1,
        user_id: user.id,
        exported_at: exportedAt,
        notes,
      },
      data,
    },
    null,
    2,
  );

  let totalBytes = dataJson.length;
  if (totalBytes > MAX_EXPORT_BYTES) {
    return errorResponse(
      "export_too_large",
      "Your export exceeds the 50 MB limit. Contact support for a manual export.",
      413,
    );
  }

  // ---- Download syllabus files (service role; paths are <user_id>/<name>) ----
  const files: Record<string, Uint8Array> = { "data.json": strToU8(dataJson) };
  try {
    let offset = 0;
    while (true) {
      const { data: objects, error: listError } = await service.storage
        .from("syllabi")
        .list(user.id, { limit: 100, offset });
      if (listError || !objects || objects.length === 0) break;
      for (const object of objects) {
        if (!object.name) continue;
        const path = `${user.id}/${object.name}`;
        const { data: blob, error: downloadError } = await service.storage
          .from("syllabi")
          .download(path);
        if (downloadError || !blob) {
          notes.push(`file ${object.name}: could not be downloaded`);
          continue;
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        totalBytes += bytes.byteLength;
        if (totalBytes > MAX_EXPORT_BYTES) {
          return errorResponse(
            "export_too_large",
            "Your export (including uploaded files) exceeds the 50 MB limit.",
            413,
          );
        }
        // Names from storage listing are basenames — no traversal risk; guard anyway.
        const safeName = object.name.replaceAll("/", "_").replaceAll("\\", "_");
        files[`files/${safeName}`] = bytes;
      }
      if (objects.length < 100) break;
      offset += objects.length;
    }
  } catch {
    notes.push("files: storage listing failed");
  }

  // Notes may have grown while downloading — regenerate data.json so they're included.
  if (notes.length > 0) {
    files["data.json"] = strToU8(
      JSON.stringify(
        {
          export: { app: "Markd", version: 1, user_id: user.id, exported_at: exportedAt, notes },
          data,
        },
        null,
        2,
      ),
    );
  }

  // ---- Zip + respond ----------------------------------------------------------
  try {
    const zipped = zipSync(files, { level: 6 });
    const filename = `markd-export-${exportedAt.slice(0, 10)}.zip`;
    return new Response(zipped.slice().buffer as ArrayBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipped.byteLength),
      },
    });
  } catch {
    return errorResponse("internal_error", "Could not assemble the export archive.", 500);
  }
});
