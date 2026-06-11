// Per-user rate limiting backed by the `public.check_rate_limit` RPC
// (security-definer function writing to the `rate_limits` table).
//
// Semantics assumed from the DB contract:
//   check_rate_limit(p_user, p_key, p_limit, p_window_seconds) returns boolean
//   → true  = call allowed (and counted)
//   → false = limit exceeded for the current window
//
// Fails CLOSED: if the RPC itself errors we deny with 503 rather than letting
// unmetered, cost-incurring work through.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "./cors.ts";
import { createServiceClient } from "./auth.ts";

/**
 * Returns null when the call is allowed, or a ready 429/503 Response when denied.
 * Usage: `const limited = await enforceRateLimit(uid, "ai-chat", 20, 60); if (limited) return limited;`
 */
export async function enforceRateLimit(
  userId: string,
  key: string,
  limit: number,
  windowSeconds: number,
  service?: SupabaseClient,
): Promise<Response | null> {
  const client = service ?? createServiceClient();
  try {
    const { data, error } = await client.rpc("check_rate_limit", {
      p_user: userId,
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      // Log only the key + error code; never request payloads.
      console.error(`rate-limit rpc failed key=${key} code=${error.code ?? "unknown"}`);
      return errorResponse(
        "rate_limit_unavailable",
        "Rate limiting is temporarily unavailable. Please try again shortly.",
        503,
        { "Retry-After": "30" },
      );
    }
    if (data !== true) {
      return errorResponse(
        "rate_limited",
        "Too many requests. Please wait before trying again.",
        429,
        { "Retry-After": String(windowSeconds) },
      );
    }
    return null;
  } catch {
    return errorResponse(
      "rate_limit_unavailable",
      "Rate limiting is temporarily unavailable. Please try again shortly.",
      503,
      { "Retry-After": "30" },
    );
  }
}
