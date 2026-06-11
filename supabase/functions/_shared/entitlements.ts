// Plan/entitlement helpers (server-side gating per spec §9).
//
//   free   → Haiku model,  50 AI messages / calendar month, no Pro features
//   pro    → Sonnet model, 2000 AI messages / calendar month, all Pro features
//   family → same entitlements as pro for each student account
//
// `profiles.plan` mirrors the canonical subscription state (subscriptions table /
// RevenueCat); cost-incurring functions re-check it before doing work.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "./cors.ts";
import { getModel } from "./anthropic.ts";

export type Plan = "free" | "pro" | "family";

export interface PlanLimits {
  /** Anthropic model id to use for this plan. */
  model: string;
  /** AI chat messages allowed per calendar month. */
  monthlyAiMessages: number;
}

/** Loads `profiles.plan`; unknown/missing values degrade safely to "free". */
export async function getPlan(client: SupabaseClient, userId: string): Promise<Plan> {
  const { data, error } = await client
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return "free";
  const plan = (data as { plan?: string }).plan;
  return plan === "pro" || plan === "family" ? plan : "free";
}

export function planLimits(plan: Plan): PlanLimits {
  if (plan === "free") {
    return { model: getModel("haiku"), monthlyAiMessages: 50 };
  }
  return { model: getModel("sonnet"), monthlyAiMessages: 2000 };
}

/** Returns a ready 403 Response for free users, or null when the plan includes Pro features. */
export function requirePro(plan: Plan): Response | null {
  if (plan === "free") {
    return errorResponse(
      "pro_required",
      "This feature requires Markd Pro. Upgrade to unlock it.",
      403,
    );
  }
  return null;
}
