// /functions/v1/stripe-webhook        (deployed with verify_jwt = false)
//
//   POST  — Stripe webhook. The Stripe-Signature header is verified manually with
//           WebCrypto HMAC-SHA256 against STRIPE_WEBHOOK_SECRET (v1 scheme, 5 min
//           tolerance). Handles checkout.session.completed,
//           customer.subscription.updated, customer.subscription.deleted.
//           The user is resolved via client_reference_id / subscription metadata
//           (both set to the Supabase user id by our checkout endpoint) with a
//           profiles.stripe_customer_id lookup as fallback. Mirrors state into
//           `subscriptions` + `profiles.plan` via the service role, and
//           best-effort forwards the purchase to RevenueCat when
//           REVENUECAT_API_KEY is set (RevenueCat stays the source of truth).
//
//   GET ?action=create-checkout&price=pro_monthly|pro_yearly|family_yearly
//         — REQUIRES a Supabase JWT (enforced in-code since verify_jwt is off).
//           Creates a Stripe Checkout Session (subscription mode, 7-day trial,
//           client_reference_id = user id) via plain form-encoded REST. → { url }
//   GET ?action=billing-portal
//         — REQUIRES a Supabase JWT. Creates a Billing Portal session. → { url }
//
// No Stripe SDK — plain fetch only. No secrets or payloads are ever logged.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  errorResponse,
  json,
  methodNotAllowed,
  preflight,
} from "../_shared/cors.ts";
import { createServiceClient, requiredEnv, requireUser } from "../_shared/auth.ts";
import { enforceRateLimit } from "../_shared/ratelimit.ts";
import { hmacSha256Hex, timingSafeEqualStr } from "../_shared/secure.ts";

const STRIPE_API = "https://api.stripe.com";
const SIGNATURE_TOLERANCE_SECONDS = 300; // 5 minutes

type SubStatus = "active" | "trialing" | "past_due" | "canceled" | "expired";
type Plan = "free" | "pro" | "family";

// ---------------------------------------------------------------------------
// Stripe REST (form-encoded fetch, no SDK)
// ---------------------------------------------------------------------------

async function stripeRequest(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const secretKey = requiredEnv("STRIPE_SECRET_KEY");
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
  };
  let url = `${STRIPE_API}${path}`;
  if (params && method === "POST") init.body = new URLSearchParams(params).toString();
  if (params && method === "GET") url += `?${new URLSearchParams(params).toString()}`;

  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    console.error(`stripe api error path=${path} status=${res.status}`);
    throw new Error(`Stripe API error (${res.status})`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Signature verification (v1 scheme): HMAC-SHA256(secret, `${t}.${payload}`)
// ---------------------------------------------------------------------------

async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  let timestamp: string | null = null;
  const v1Signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") timestamp = value;
    else if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  return v1Signatures.some((candidate) => timingSafeEqualStr(expected, candidate));
}

// ---------------------------------------------------------------------------
// Plan / status mapping
// ---------------------------------------------------------------------------

function planFromPrice(priceId: string | null): Plan | null {
  if (!priceId) return null;
  if (priceId === Deno.env.get("STRIPE_PRICE_FAMILY_YEARLY")) return "family";
  if (
    priceId === Deno.env.get("STRIPE_PRICE_PRO_MONTHLY") ||
    priceId === Deno.env.get("STRIPE_PRICE_PRO_YEARLY")
  ) {
    return "pro";
  }
  return null;
}

function mapStripeStatus(status: string): SubStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
      return "canceled";
    default: // incomplete_expired, paused, anything new
      return "expired";
  }
}

function epochToIso(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}

// ---------------------------------------------------------------------------
// User resolution + persistence
// ---------------------------------------------------------------------------

async function findUserByCustomerId(
  service: SupabaseClient,
  customerId: string,
): Promise<string | null> {
  const { data } = await service
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

interface StripeSubscription {
  id?: string;
  status?: string;
  customer?: string;
  current_period_start?: number;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ price?: { id?: string } }> };
}

/** Upserts the subscriptions row (manual select→update/insert; no unique index assumed). */
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
    .eq("source", "stripe")
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
      .insert({ user_id: userId, source: "stripe", ...fields });
  }
}

async function applySubscription(
  service: SupabaseClient,
  userId: string,
  sub: StripeSubscription,
  rawEvent: unknown,
): Promise<void> {
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const status = mapStripeStatus(sub.status ?? "expired");
  // past_due keeps access (grace period); canceled/expired drop to free.
  const entitled = status === "active" || status === "trialing" || status === "past_due";
  const plan: Plan = entitled ? (planFromPrice(priceId) ?? "pro") : "free";

  await upsertSubscription(service, userId, {
    product_id: priceId,
    status,
    period_start: epochToIso(sub.current_period_start),
    period_end: epochToIso(sub.current_period_end),
    raw_event: rawEvent,
  });

  const profileUpdate: Record<string, unknown> = { plan };
  if (typeof sub.customer === "string" && sub.customer) {
    profileUpdate.stripe_customer_id = sub.customer;
  }
  await service.from("profiles").update(profileUpdate).eq("id", userId);

  // Best-effort mirror into RevenueCat (Stripe receipts API) so RC stays the
  // cross-platform source of truth. Failures are logged (status only) and ignored.
  const rcKey = Deno.env.get("REVENUECAT_API_KEY");
  if (rcKey && sub.id && entitled) {
    try {
      const res = await fetch("https://api.revenuecat.com/v1/receipts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${rcKey}`,
          "Content-Type": "application/json",
          "X-Platform": "stripe",
        },
        body: JSON.stringify({ app_user_id: userId, fetch_token: sub.id }),
      });
      if (!res.ok) console.error(`revenuecat mirror failed status=${res.status}`);
    } catch {
      console.error("revenuecat mirror failed: network");
    }
  }
}

// ---------------------------------------------------------------------------
// POST: webhook
// ---------------------------------------------------------------------------

interface StripeEvent {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
}

async function handleWebhook(req: Request): Promise<Response> {
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return errorResponse("misconfigured", "Webhook secret is not configured.", 500);
  }

  const payload = await req.text();
  const verified = await verifyStripeSignature(
    payload,
    req.headers.get("stripe-signature"),
    webhookSecret,
  );
  if (!verified) {
    return errorResponse("invalid_signature", "Stripe signature verification failed.", 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return errorResponse("invalid_request", "Malformed event payload.", 400);
  }

  const service = createServiceClient();
  const object = event.data?.object ?? {};

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = object as {
          client_reference_id?: string;
          customer?: string;
          subscription?: string;
          metadata?: Record<string, string>;
          mode?: string;
        };
        let userId = session.client_reference_id ?? session.metadata?.supabase_user_id ?? null;
        if (!userId && typeof session.customer === "string") {
          userId = await findUserByCustomerId(service, session.customer);
        }
        if (!userId) {
          console.error("stripe-webhook: checkout completed without resolvable user");
          break; // ack — retrying will not help
        }
        if (typeof session.customer === "string" && session.customer) {
          await service
            .from("profiles")
            .update({ stripe_customer_id: session.customer })
            .eq("id", userId);
        }
        if (session.mode === "subscription" && typeof session.subscription === "string") {
          // The session object carries no price/period info — fetch the subscription.
          const sub = (await stripeRequest(
            "GET",
            `/v1/subscriptions/${session.subscription}`,
          )) as StripeSubscription;
          await applySubscription(service, userId, sub, event);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = object as unknown as StripeSubscription;
        let userId = sub.metadata?.supabase_user_id ?? null;
        if (!userId && typeof sub.customer === "string") {
          userId = await findUserByCustomerId(service, sub.customer);
        }
        if (!userId) {
          console.error(`stripe-webhook: ${event.type} without resolvable user`);
          break; // ack
        }
        if (event.type === "customer.subscription.deleted") {
          // Deleted = subscription fully ended regardless of embedded status.
          await applySubscription(service, userId, { ...sub, status: "canceled" }, event);
        } else {
          await applySubscription(service, userId, sub, event);
        }
        break;
      }

      default:
        break; // unhandled event types are acknowledged
    }
  } catch {
    console.error(`stripe-webhook: processing failed type=${event.type ?? "unknown"}`);
    // Non-2xx so Stripe retries transient failures.
    return errorResponse("processing_failed", "Event could not be processed.", 500);
  }

  return json({ received: true });
}

// ---------------------------------------------------------------------------
// GET: create-checkout / billing-portal (JWT required — enforced here)
// ---------------------------------------------------------------------------

const PRICE_KEYS: Record<string, string> = {
  pro_monthly: "STRIPE_PRICE_PRO_MONTHLY",
  pro_yearly: "STRIPE_PRICE_PRO_YEARLY",
  family_yearly: "STRIPE_PRICE_FAMILY_YEARLY",
};

async function handleCreateCheckout(req: Request, url: URL): Promise<Response> {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const service = createServiceClient();
  const limited = await enforceRateLimit(user.id, "stripe-checkout", 10, 3600, service);
  if (limited) return limited;

  const priceKey = url.searchParams.get("price") ?? "";
  const envName = PRICE_KEYS[priceKey];
  if (!envName) {
    return errorResponse(
      "invalid_request",
      'Query param "price" must be one of: pro_monthly, pro_yearly, family_yearly.',
      400,
    );
  }
  const priceId = Deno.env.get(envName);
  if (!priceId) return errorResponse("misconfigured", "This price is not configured.", 500);

  const appUrl = (Deno.env.get("APP_WEB_URL") ?? "").replace(/\/$/, "");
  if (!appUrl) return errorResponse("misconfigured", "APP_WEB_URL is not configured.", 500);

  const { data: profile } = await service
    .from("profiles")
    .select("stripe_customer_id,email")
    .eq("id", user.id)
    .maybeSingle();
  const customerId = (profile as { stripe_customer_id?: string | null } | null)
    ?.stripe_customer_id ?? null;
  const email = (profile as { email?: string | null } | null)?.email ?? user.email ?? null;

  const params: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    client_reference_id: user.id,
    success_url: `${appUrl}/paywall?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/paywall?checkout=cancelled`,
    "subscription_data[trial_period_days]": "7",
    "subscription_data[metadata][supabase_user_id]": user.id,
    "metadata[supabase_user_id]": user.id,
    allow_promotion_codes: "true", // educational discount codes
  };
  if (customerId) params.customer = customerId;
  else if (email) params.customer_email = email;

  try {
    const session = await stripeRequest("POST", "/v1/checkout/sessions", params);
    const sessionUrl = typeof session.url === "string" ? session.url : null;
    if (!sessionUrl) throw new Error("missing url");
    return json({ url: sessionUrl });
  } catch {
    return errorResponse("stripe_unavailable", "Could not start checkout. Try again shortly.", 502);
  }
}

async function handleBillingPortal(req: Request): Promise<Response> {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const service = createServiceClient();
  const limited = await enforceRateLimit(user.id, "stripe-portal", 10, 3600, service);
  if (limited) return limited;

  const { data: profile } = await service
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  const customerId = (profile as { stripe_customer_id?: string | null } | null)
    ?.stripe_customer_id;
  if (!customerId) {
    return errorResponse(
      "no_billing_account",
      "No Stripe billing account exists for this user yet.",
      400,
    );
  }

  const appUrl = (Deno.env.get("APP_WEB_URL") ?? "").replace(/\/$/, "");
  try {
    const session = await stripeRequest("POST", "/v1/billing_portal/sessions", {
      customer: customerId,
      return_url: appUrl || "https://markd.app",
    });
    const sessionUrl = typeof session.url === "string" ? session.url : null;
    if (!sessionUrl) throw new Error("missing url");
    return json({ url: sessionUrl });
  } catch {
    return errorResponse(
      "stripe_unavailable",
      "Could not open the billing portal. Try again shortly.",
      502,
    );
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method === "GET") {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    if (action === "create-checkout") return handleCreateCheckout(req, url);
    if (action === "billing-portal") return handleBillingPortal(req);
    return errorResponse(
      "invalid_request",
      'Query param "action" must be "create-checkout" or "billing-portal".',
      400,
    );
  }

  if (req.method === "POST") return handleWebhook(req);
  return methodNotAllowed();
});
