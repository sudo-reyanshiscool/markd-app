// POST /functions/v1/account-delete   { confirm: "DELETE" }
//
// GDPR account deletion. JWT → the body must contain the literal confirmation
// string "DELETE" → service role removes every storage object under
// <user_id>/ in the `syllabi` and `avatars` buckets → auth.admin.deleteUser()
// (all rows cascade via `on delete cascade` FKs to auth.users) → 204 No Content.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders,
  errorResponse,
  methodNotAllowed,
  preflight,
  readJson,
} from "../_shared/cors.ts";
import { createServiceClient, requireUser } from "../_shared/auth.ts";

const BUCKETS = ["syllabi", "avatars"] as const;
const LIST_PAGE = 100;
const MAX_LIST_LOOPS = 100; // safety bound: 10k objects per bucket

async function purgeBucketPrefix(
  service: SupabaseClient,
  bucket: string,
  userId: string,
): Promise<void> {
  for (let loop = 0; loop < MAX_LIST_LOOPS; loop++) {
    const { data: objects, error: listError } = await service.storage
      .from(bucket)
      .list(userId, { limit: LIST_PAGE });
    if (listError) {
      // The bucket may not exist in this environment — treat as already clean.
      console.error(`account-delete: list failed bucket=${bucket}`);
      return;
    }
    if (!objects || objects.length === 0) return;

    const paths = objects
      .filter((object) => Boolean(object.name))
      .map((object) => `${userId}/${object.name}`);
    if (paths.length === 0) return;

    const { error: removeError } = await service.storage.from(bucket).remove(paths);
    if (removeError) {
      console.error(`account-delete: remove failed bucket=${bucket}`);
      return; // do not block account deletion on storage hiccups
    }
    if (objects.length < LIST_PAGE) return;
  }
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed();

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const body = await readJson<{ confirm?: unknown }>(req);
  if (body?.confirm !== "DELETE") {
    return errorResponse(
      "confirmation_required",
      'Account deletion requires { "confirm": "DELETE" } in the request body.',
      400,
    );
  }

  const service = createServiceClient();

  // 1) Remove storage objects (these do NOT cascade with the auth user).
  for (const bucket of BUCKETS) {
    await purgeBucketPrefix(service, bucket, user.id);
  }

  // 2) Delete the auth user — profiles and every user-owned row cascade.
  const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("account-delete: deleteUser failed");
    return errorResponse(
      "internal_error",
      "The account could not be deleted. Please try again or contact support.",
      500,
    );
  }

  return new Response(null, { status: 204, headers: corsHeaders });
});
