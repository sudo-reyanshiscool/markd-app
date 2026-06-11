// POST /functions/v1/calendar-import
//   { url: string, label?: string }  → create a calendar_feeds row and sync it
//   { feed_id: string }              → re-sync an existing feed
//
// JWT → rate limit (calendar-import, 6/hour) → Pro entitlement (calendar feeds are
// a Pro feature per spec §9) → SSRF-hardened fetch (spec §10) → robust ICS parse →
// upsert calendar_events on (feed_id, uid), delete rows whose uid disappeared →
// update calendar_feeds (status, last_synced_at, last_event_count, last_error).
//
// SSRF protections (all enforced BEFORE any network call):
//   - https:// only; no userinfo; port must be 443 (or default)
//   - hostname must not be localhost/.local/.internal or an IP literal in
//     private/loopback/link-local space (10/8, 172.16/12, 192.168/16, 127/8,
//     169.254/16, 0/8, CGNAT 100.64/10, multicast/reserved, fc00::/7, fe80::/10,
//     ::1, ::, IPv4-mapped IPv6)
//   - Deno.resolveDns A+AAAA results must ALL be public addresses
//   - fetch with redirect: "error", 10s abort, streamed body aborted past 5 MB

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  errorResponse,
  json,
  methodNotAllowed,
  preflight,
  readJson,
} from "../_shared/cors.ts";
import { createServiceClient, requireUser } from "../_shared/auth.ts";
import { enforceRateLimit } from "../_shared/ratelimit.ts";
import { getPlan, requirePro } from "../_shared/entitlements.ts";
import { isUuid } from "../_shared/secure.ts";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_EVENTS_PER_FEED = 2000;
const MAX_URL_CHARS = 2048;

// ---------------------------------------------------------------------------
// SSRF protection
// ---------------------------------------------------------------------------

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateIPv4(ip: string): boolean {
  const match = IPV4_RE.exec(ip);
  if (!match) return true; // unparseable → treat as unsafe
  const octets = match.slice(1).map((part) => Number.parseInt(part, 10));
  if (octets.some((o) => !Number.isFinite(o) || o > 255)) return true;
  const [a, b] = octets as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // 127/8 loopback
  if (a === 169 && b === 254) return true; // 169.254/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a >= 224) return true; // multicast 224/4 + reserved 240/4 + broadcast
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0] ?? "";
  if (!addr) return true;
  if (addr === "::" || addr === "::1") return true; // unspecified / loopback
  // IPv4-mapped or IPv4-compatible (::ffff:a.b.c.d, ::a.b.c.d)
  const v4Tail = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(addr);
  if (v4Tail?.[1]) return isPrivateIPv4(v4Tail[1]);
  // First hextet decides fc00::/7 (unique local) and fe80::/10 (link-local).
  const firstGroup = addr.startsWith("::") ? "0" : addr.split(":")[0] || "0";
  const first = Number.parseInt(firstGroup, 16);
  if (!Number.isFinite(first)) return true;
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10
  if (first === 0) return true; // ::/8 (covers mapped ranges conservatively)
  return false;
}

function looksLikeIPv6(host: string): boolean {
  return host.includes(":");
}

/** Validates the feed URL. Returns the parsed URL or an error message string. */
async function validateFeedUrl(rawUrl: string): Promise<URL | string> {
  if (rawUrl.length > MAX_URL_CHARS) return "URL is too long.";
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "That is not a valid URL.";
  }
  if (url.protocol !== "https:") return "Only https:// calendar URLs are allowed.";
  if (url.username || url.password) return "URLs with embedded credentials are not allowed.";
  if (url.port && url.port !== "443") return "Only port 443 is allowed.";

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return "The URL has no hostname.";
  if (
    host === "localhost" || host.endsWith(".localhost") ||
    host.endsWith(".local") || host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    return "Local hostnames are not allowed.";
  }

  // IP-literal hosts are validated directly (no DNS step).
  const bareHost = host.replace(/^\[|\]$/g, "");
  if (IPV4_RE.test(bareHost)) {
    if (isPrivateIPv4(bareHost)) return "Private network addresses are not allowed.";
    return url;
  }
  if (looksLikeIPv6(bareHost)) {
    if (isPrivateIPv6(bareHost)) return "Private network addresses are not allowed.";
    return url;
  }

  // Domain names: every resolved A/AAAA record must be public.
  const resolved: string[] = [];
  for (const recordType of ["A", "AAAA"] as const) {
    try {
      const records = await Deno.resolveDns(bareHost, recordType);
      for (const record of records) resolved.push(String(record));
    } catch {
      // No records of this type — fine as long as the other type resolves.
    }
  }
  if (resolved.length === 0) return "The hostname could not be resolved.";
  for (const address of resolved) {
    const unsafe = looksLikeIPv6(address) ? isPrivateIPv6(address) : isPrivateIPv4(address);
    if (unsafe) return "The hostname resolves to a private network address.";
  }
  return url;
}

/** Fetches the ICS body with timeout, no redirects, and a hard 5 MB streaming cap. */
async function fetchIcsBody(url: URL): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      redirect: "error",
      signal: controller.signal,
      headers: {
        "user-agent": "Markd-CalendarSync/1.0",
        accept: "text/calendar, text/plain;q=0.9, */*;q=0.5",
      },
    });
    if (!res.ok) throw new Error(`The calendar server responded with HTTP ${res.status}.`);

    const declaredLength = Number(res.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_BODY_BYTES) {
      throw new Error("The calendar file is larger than the 5 MB limit.");
    }
    if (!res.body) throw new Error("The calendar server sent an empty response.");

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
        controller.abort();
        throw new Error("The calendar file is larger than the 5 MB limit.");
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(merged);
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new Error("The calendar server took too long to respond (10s limit).");
    }
    throw err instanceof Error ? err : new Error("Could not download the calendar.");
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// ICS parsing (tolerant): unfold folded lines, walk VEVENT blocks, read
// UID/SUMMARY/DTSTART/DTEND/LOCATION/DESCRIPTION, DATE vs DATE-TIME, treat
// TZID/floating times as UTC fallback, ignore RRULE beyond the first occurrence.
// ---------------------------------------------------------------------------

export interface ParsedEvent {
  uid: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  description: string | null;
  all_day: boolean;
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

interface IcsProp {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseIcsLine(line: string): IcsProp | null {
  const colonIndex = findUnquotedColon(line);
  if (colonIndex < 0) return null;
  const left = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const segments = left.split(";");
  const name = (segments.shift() ?? "").trim().toUpperCase();
  if (!name) return null;
  const params: Record<string, string> = {};
  for (const segment of segments) {
    const eq = segment.indexOf("=");
    if (eq > 0) {
      params[segment.slice(0, eq).trim().toUpperCase()] = segment
        .slice(eq + 1)
        .trim()
        .replace(/^"|"$/g, "");
    }
  }
  return { name, params, value };
}

/** Param values may be quoted and contain ':' (e.g. TZID="A:B") — find the real separator. */
function findUnquotedColon(line: string): number {
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ":" && !inQuotes) return i;
  }
  return -1;
}

interface ParsedIcsDate {
  iso: string;
  allDay: boolean;
}

function parseIcsDate(prop: IcsProp): ParsedIcsDate | null {
  const value = prop.value.trim();
  // DATE form: 20260612
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly || prop.params["VALUE"] === "DATE") {
    const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(value);
    if (!m) return null;
    const [, y, mo, d] = m;
    const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d));
    if (!Number.isFinite(ms)) return null;
    return { iso: new Date(ms).toISOString(), allDay: true };
  }
  // DATE-TIME form: 20260612T130000Z (UTC) / 20260612T130000 (floating or TZID → UTC fallback)
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/.exec(value);
  if (dateTime) {
    const [, y, mo, d, h, mi, s] = dateTime;
    const ms = Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s ?? "0"),
    );
    if (!Number.isFinite(ms)) return null;
    return { iso: new Date(ms).toISOString(), allDay: false };
  }
  return null;
}

export function parseIcs(body: string): ParsedEvent[] {
  // Unfold: a CRLF/LF followed by a space or tab continues the previous line.
  const unfolded = body.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  const events: ParsedEvent[] = [];
  const seenUids = new Set<string>(); // RRULE/RECURRENCE-ID expansions repeat UIDs — keep first
  let current: Record<string, IcsProp> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^BEGIN:VEVENT$/i.test(trimmed)) {
      current = {};
      continue;
    }
    if (/^END:VEVENT$/i.test(trimmed)) {
      if (current) {
        const event = buildEvent(current);
        if (event && !seenUids.has(event.uid)) {
          seenUids.add(event.uid);
          events.push(event);
        }
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const prop = parseIcsLine(line);
    if (!prop) continue;
    if (["UID", "SUMMARY", "DTSTART", "DTEND", "LOCATION", "DESCRIPTION"].includes(prop.name)) {
      // Keep the first occurrence of each property within a VEVENT.
      if (!(prop.name in current)) current[prop.name] = prop;
    }
    if (events.length >= MAX_EVENTS_PER_FEED) break;
  }
  return events;
}

function buildEvent(props: Record<string, IcsProp>): ParsedEvent | null {
  const uid = props["UID"]?.value.trim().slice(0, 512);
  const startProp = props["DTSTART"];
  if (!uid || !startProp) return null;
  const start = parseIcsDate(startProp);
  if (!start) return null;

  const endProp = props["DTEND"];
  const end = endProp ? parseIcsDate(endProp) : null;

  const title = props["SUMMARY"] ? unescapeIcsText(props["SUMMARY"].value).slice(0, 300) : "";
  const location = props["LOCATION"] ? unescapeIcsText(props["LOCATION"].value).slice(0, 300) : "";
  const description = props["DESCRIPTION"]
    ? unescapeIcsText(props["DESCRIPTION"].value).slice(0, 2000)
    : "";

  return {
    uid,
    title: title || "Untitled event",
    starts_at: start.iso,
    ends_at: end?.iso ?? start.iso,
    location: location || null,
    description: description || null,
    all_day: start.allDay,
  };
}

// ---------------------------------------------------------------------------
// Sync: upsert on (feed_id, uid), delete disappeared uids, update feed status.
// ---------------------------------------------------------------------------

interface SyncResult {
  imported: number;
  deleted: number;
}

async function syncFeed(
  db: SupabaseClient,
  userId: string,
  feedId: string,
  events: ParsedEvent[],
): Promise<SyncResult> {
  const capped = events.slice(0, MAX_EVENTS_PER_FEED);

  // Upsert in chunks.
  const CHUNK = 200;
  for (let i = 0; i < capped.length; i += CHUNK) {
    const rows = capped.slice(i, i + CHUNK).map((event) => ({
      user_id: userId,
      feed_id: feedId,
      ...event,
    }));
    const { error } = await db
      .from("calendar_events")
      .upsert(rows, { onConflict: "feed_id,uid" });
    if (error) throw new Error("Could not save imported events.");
  }

  // Delete events whose uid disappeared from the feed.
  const { data: existingRows, error: existingError } = await db
    .from("calendar_events")
    .select("uid")
    .eq("feed_id", feedId)
    .limit(10_000);
  if (existingError) throw new Error("Could not reconcile existing events.");
  const keep = new Set(capped.map((event) => event.uid));
  const disappeared = ((existingRows ?? []) as Array<{ uid: string }>)
    .map((row) => row.uid)
    .filter((uid) => !keep.has(uid));
  for (let i = 0; i < disappeared.length; i += CHUNK) {
    const chunk = disappeared.slice(i, i + CHUNK);
    const { error } = await db
      .from("calendar_events")
      .delete()
      .eq("feed_id", feedId)
      .in("uid", chunk);
    if (error) throw new Error("Could not remove stale events.");
  }

  return { imported: capped.length, deleted: disappeared.length };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed();

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user, supabase } = auth;

  const service = createServiceClient();
  const limited = await enforceRateLimit(user.id, "calendar-import", 6, 3600, service);
  if (limited) return limited;

  const plan = await getPlan(service, user.id);
  const gated = requirePro(plan);
  if (gated) return gated;

  const body = await readJson<{ feed_id?: unknown; url?: unknown; label?: unknown }>(req);
  const feedIdInput = isUuid(body?.feed_id) ? (body?.feed_id as string) : null;
  const urlInput = typeof body?.url === "string" ? body.url.trim() : null;
  if (!feedIdInput && !urlInput) {
    return errorResponse(
      "invalid_request",
      'Provide "url" (and optional "label") to add a feed, or "feed_id" to re-sync one.',
      400,
    );
  }

  // Resolve the feed row (create on first import).
  let feedId: string;
  let feedUrl: string;
  if (feedIdInput) {
    const { data: feed, error } = await supabase
      .from("calendar_feeds")
      .select("id,url")
      .eq("id", feedIdInput)
      .maybeSingle();
    if (error) return errorResponse("internal_error", "Could not load the feed.", 500);
    if (!feed) return errorResponse("not_found", "Calendar feed not found.", 404);
    feedId = (feed as { id: string }).id;
    feedUrl = (feed as { url: string }).url;
  } else {
    const validated = await validateFeedUrl(urlInput as string);
    if (typeof validated === "string") {
      return errorResponse("url_not_allowed", validated, 400);
    }
    const label = typeof body?.label === "string" ? body.label.trim().slice(0, 80) : null;
    const { data: feed, error } = await supabase
      .from("calendar_feeds")
      .insert({ user_id: user.id, url: validated.toString(), label, status: "pending" })
      .select("id,url")
      .single();
    if (error || !feed) {
      return errorResponse("internal_error", "Could not create the calendar feed.", 500);
    }
    feedId = (feed as { id: string }).id;
    feedUrl = (feed as { url: string }).url;
  }

  // Stored URLs are re-validated on every sync (DNS may have changed).
  const validatedUrl = await validateFeedUrl(feedUrl);
  if (typeof validatedUrl === "string") {
    await supabase
      .from("calendar_feeds")
      .update({ status: "error", last_error: validatedUrl })
      .eq("id", feedId);
    return errorResponse("url_not_allowed", validatedUrl, 400);
  }

  try {
    const icsBody = await fetchIcsBody(validatedUrl);
    const events = parseIcs(icsBody);
    if (events.length === 0 && !/BEGIN:VCALENDAR/i.test(icsBody)) {
      throw new Error("The URL did not return an iCalendar (.ics) file.");
    }

    const { imported, deleted } = await syncFeed(supabase, user.id, feedId, events);

    const syncedAt = new Date().toISOString();
    await supabase
      .from("calendar_feeds")
      .update({
        status: "ok",
        last_synced_at: syncedAt,
        last_event_count: imported,
        last_error: null,
      })
      .eq("id", feedId);

    return json({
      feed: { id: feedId, status: "ok", last_synced_at: syncedAt, last_event_count: imported },
      imported,
      deleted,
    });
  } catch (err) {
    // Reasons are derived from our own thrown messages — never raw upstream bodies.
    const reason = err instanceof Error && err.message
      ? err.message.slice(0, 300)
      : "The calendar could not be synced.";
    await supabase
      .from("calendar_feeds")
      .update({ status: "error", last_error: reason })
      .eq("id", feedId);
    return errorResponse("sync_failed", reason, 422);
  }
});
