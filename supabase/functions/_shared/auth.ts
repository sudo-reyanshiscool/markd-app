// Authentication helpers.
//
// - `requireUser(req)` validates the caller's Supabase JWT and returns a USER-SCOPED
//   client (anon key + the caller's Authorization header) so every query runs under RLS.
// - `createServiceClient()` returns a service-role client for privileged work only
//   (rate-limit RPC, webhooks, storage admin, cross-user batch jobs). Never use it to
//   read/write user rows on behalf of an AI tool call.

import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2";
import { errorResponse } from "./cors.ts";

/** Reads a required environment variable, throwing a non-leaky error when absent. */
export function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export interface AuthContext {
  user: User;
  /** User-scoped client — all PostgREST/storage calls run with the caller's JWT (RLS applies). */
  supabase: SupabaseClient;
  /** The raw JWT, in case a function needs to forward it. */
  token: string;
}

/** Builds a user-scoped client from an Authorization header value ("Bearer <jwt>"). */
export function createUserClient(authHeader: string): SupabaseClient {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Validates the caller. Returns an AuthContext on success or a ready 401 Response on failure.
 * Usage: `const auth = await requireUser(req); if (auth instanceof Response) return auth;`
 */
export async function requireUser(req: Request): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse("unauthorized", "A valid Authorization bearer token is required.", 401);
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return errorResponse("unauthorized", "A valid Authorization bearer token is required.", 401);
  }
  try {
    const supabase = createUserClient(authHeader);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return errorResponse("unauthorized", "Invalid or expired session.", 401);
    }
    return { user: data.user, supabase, token };
  } catch {
    // Never leak internals — a failed validation is always a plain 401.
    return errorResponse("unauthorized", "Could not validate the session.", 401);
  }
}

/** Service-role client factory (bypasses RLS — privileged paths only). */
export function createServiceClient(): SupabaseClient {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
