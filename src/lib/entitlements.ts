import { Plan } from "@/db/schemas";

/**
 * Centralised feature gating (spec §9). The client mirrors what every
 * cost-incurring Edge Function re-checks server-side — client gates are UX,
 * not security.
 */

export interface PlanLimits {
  maxSubjects: number;
  maxTasks: number;
  aiMessagesPerMonth: number;
  aiModelLabel: string;
  calendarFeeds: boolean;
  syllabusAi: boolean;
  exports: boolean;
  shareLinks: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxSubjects: 3,
    maxTasks: 50,
    aiMessagesPerMonth: 50,
    aiModelLabel: "Claude Haiku",
    calendarFeeds: false,
    syllabusAi: false,
    exports: false,
    shareLinks: 0,
  },
  pro: {
    maxSubjects: Number.POSITIVE_INFINITY,
    maxTasks: Number.POSITIVE_INFINITY,
    aiMessagesPerMonth: 2000,
    aiModelLabel: "Claude Sonnet",
    calendarFeeds: true,
    syllabusAi: true,
    exports: true,
    shareLinks: 1,
  },
  family: {
    maxSubjects: Number.POSITIVE_INFINITY,
    maxTasks: Number.POSITIVE_INFINITY,
    aiMessagesPerMonth: 2000,
    aiModelLabel: "Claude Sonnet",
    calendarFeeds: true,
    syllabusAi: true,
    exports: true,
    shareLinks: 1,
  },
};

export type EntitlementKey =
  | "calendarFeeds"
  | "syllabusAi"
  | "exports"
  | "shareLinks";

export function planAllows(plan: Plan, key: EntitlementKey): boolean {
  const limits = PLAN_LIMITS[plan];
  if (key === "shareLinks") return limits.shareLinks > 0;
  return Boolean(limits[key]);
}

export function withinSubjectLimit(plan: Plan, currentCount: number): boolean {
  return currentCount < PLAN_LIMITS[plan].maxSubjects;
}

export function withinTaskLimit(plan: Plan, currentCount: number): boolean {
  return currentCount < PLAN_LIMITS[plan].maxTasks;
}

export const PRICES = {
  proMonthly: "£3.99/mo",
  proYearly: "£29/yr",
  familyYearly: "£49/yr",
  trialDays: 7,
  eduDiscountPct: 15,
} as const;

/** Verified education email → 15% discount eligibility (spec §9). */
export function isEduEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return /\.(edu|ac\.uk)$/.test(lower) || lower.endsWith(".edu.au");
}
