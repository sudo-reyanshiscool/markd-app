// POST /functions/v1/revenuecat-webhook        (deployed with verify_jwt = false)
//
// RevenueCat server-to-server webhook. Authenticated by a static header:
// the request's Authorization header must exactly equal env RC_WEBHOOK_AUTH
// (configure the same value in the RevenueCat dashboard webhook settings).
//
// Handled event types: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION,
// PRODUCT_CHANGE, BILLING_ISSUE. `app_user_id` is the Supabase user id (the
// app logs into RevenueCat with the Supabase uid); anonymous RC ids are
// resolved via original_app_user_id / aliases. Mirrors state into
// `subscriptions` (source "revenuecat") and `profiles.plan` from the
// entitlement ids ("pro" / "family").
//
// Semantics:
//   INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE → active (or trialing for TRIAL periods)
//   CANCELLATION  → status canceled, plan KEPT (access runs until expiration)
//   BILLING_ISSUE → status past_due, plan KEPT (grace period)
//   EXPIRATION    → status expired, plan → free

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  errorResponse,
  json,
  methodNotAllowed,
  preflight,
  readJson,
} from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { isUuid, timingSafeEqualStr } from "../_shared/secure.ts";

type SubStatus = "active" | "trialing" | "past_due" | "canceled" | "expired";
type Plan = "free" | "pro" | "family";

interface RcEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[] | null;
  period_type?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number;
  store?: string;
  id?: string;
}

function resolveUserId(event: RcEvent): string | null {
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...(Array.isArray(event.aliases) ? event.aliases : []),
  ];
  for (const candidate of candidates) {
    if (isUuid(candidate)) return candidate;
  }
  return null;
}

function planFromEntitlements(entitlementIds: string[] | null | undefined): Plan {
  const ids = (entitlementIds ?? []).map((id) => id.toLowerCase());
  if (ids.some((id) => id.includes("family"))) return "family";
  if (ids.length > 0) return "pro";
  return "pro"; // a purchase event with no entitlement ids still grants pro
}

function msToIso(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value).toISOString()
    : null;
}

async function upsertSubscription(
  service: SupabaseClient,
  userId: string,
  fields: {
    product_id: string | null;
    status: SubStatus;
    period_start: string | null;
    period_end: string | null;
    raw_event: unknown;
  },
): Promise<void> {
  const { data: existing } = await service
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("source", "revenuecat")
    .limit(1)
    .maybeSingle();
  if (existing) {
    await service
      .from("subscriptions")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", (existing as { id: string }).id);
  } else {
    await service
      .from("subscriptions")
      .insert({ user_id: userId, source: "revenuecat", ...fields });
  }
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed();

  // Static auth header (constant-time compare) — set the same value in RevenueCat.
  const expectedAuth = Deno.env.get("RC_WEBHOOK_AUTH");
  const providedAuth = req.headers.get("Authorization") ?? "";
  if (!expectedAuth || !timingSafeEqualStr(providedAuth, expectedAuth)) {
    return errorResponse("unauthorized", "Invalid webhook authorization.", 401);
  }

  const body = await readJson<{ event?: RcEvent }>(req);
  const event = body?.event;
  if (!event || typeof event.type !== "string") {
    return errorResponse("invalid_request", "Missing event payload.", 400);
  }

  const userId = resolveUserId(event);
  if (!userId) {
    // Anonymous purchase with no Supabase uid anywhere — acknowledge so RC stops retrying.
    console.error(`revenuecat-webhook: no resolvable user for type=${event.type}`);
    return json({ received: true, skipped: "unresolvable_user" });
  }

  const service = createServiceClient();
  const entitledPlan = planFromEntitlements(event.entitlement_ids);
  const periodStart = msToIso(event.purchased_at_ms);
  const periodEnd = msToIso(event.expiration_at_ms);
  const productId = typeof event.product_id === "string" ? event.product_id : null;

  let status: SubStatus | null = null;
  let plan: Plan | null = null; // null = leave profiles.plan unchanged

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
      status = event.period_type === "TRIAL" ? "trialing" : "active";
      plan = entitledPlan;
      break;
    case "CANCELLATION":
      // Auto-renew turned off — access continues until EXPIRATION arrives.
      status = "canceled";
      plan = null;
      break;
    case "BILLING_ISSUE":
      status = "past_due";
      plan = null; // grace period
      break;
    case "EXPIRATION":
      status = "expired";
      plan = "free";
      break;
    default:
      // TRANSFER, TEST, SUBSCRIBER_ALIAS, etc. — acknowledge without changes.
      return json({ received: true, skipped: "unhandled_type" });
  }

  try {
    await upsertSubscription(service, userId, {
      product_id: productId,
      status,
      period_start: periodStart,
      period_end: periodEnd,
      raw_event: body,
    });

    const profileUpdate: Record<string, unknown> = {
      revenuecat_id: event.original_app_user_id ?? event.app_user_id ?? null,
    };
    if (plan !== null) profileUpdate.plan = plan;
    await service.from("profiles").update(profileUpdate).eq("id", userId);
  } catch {
    console.error(`revenuecat-webhook: processing failed type=${event.type}`);
    return errorResponse("processing_failed", "Event could not be processed.", 500);
  }

  return json({ received: true });
});
