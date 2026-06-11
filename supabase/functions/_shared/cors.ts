// Shared CORS + JSON response helpers for all Markd Edge Functions.
//
// Every function:
//   1. answers OPTIONS preflight via `preflight(req)`,
//   2. returns errors in the canonical shape { error: { code, message } },
//   3. never leaks stack traces or secrets in responses.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, stripe-signature",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/** Returns a ready preflight response for OPTIONS requests, or null for other methods. */
export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

/** JSON response with CORS headers. */
export function json(
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...extra,
    },
  });
}

/** Canonical error shape: { error: { code, message } }. */
export function errorResponse(
  code: string,
  message: string,
  status: number,
  extra: Record<string, string> = {},
): Response {
  return json({ error: { code, message } }, status, extra);
}

export function methodNotAllowed(): Response {
  return errorResponse(
    "method_not_allowed",
    "This method is not supported on this endpoint.",
    405,
  );
}

/** Parses a JSON request body; returns null when missing/malformed (caller decides the error). */
export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
