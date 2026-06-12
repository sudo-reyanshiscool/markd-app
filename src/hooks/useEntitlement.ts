import { useRouter } from "expo-router";

import { Plan } from "@/db/schemas";
import {
  EntitlementKey,
  PLAN_LIMITS,
  planAllows,
  withinSubjectLimit,
  withinTaskLimit,
} from "@/lib/entitlements";
import { useProfile } from "@/features/auth/hooks";
import { useSessionStore } from "@/stores/session";

import { useEntityList } from "./useEntities";

/** The active plan: guests are free; authed users read profiles.plan. */
export function usePlan(): Plan {
  const mode = useSessionStore((s) => s.mode);
  const profile = useProfile();
  if (mode === "authed") return profile.data?.plan ?? "free";
  return "free";
}

/**
 * `useEntitlement('syllabusAi')` → { allowed, requirePro } where requirePro
 * routes to the paywall when blocked (spec §9 client gating).
 */
export function useEntitlement(key: EntitlementKey) {
  const plan = usePlan();
  const router = useRouter();
  const allowed = planAllows(plan, key);
  return {
    plan,
    allowed,
    limits: PLAN_LIMITS[plan],
    /** Returns true when the action may proceed; otherwise shows the paywall. */
    requirePro: (): boolean => {
      if (allowed) return true;
      router.push("/paywall");
      return false;
    },
  };
}

/** Count-based gates for free-plan ceilings (3 subjects / 50 tasks). */
export function useQuotaGate() {
  const plan = usePlan();
  const router = useRouter();
  const subjects = useEntityList("subjects");
  const tasks = useEntityList("tasks");

  const subjectCount = (subjects.data ?? []).filter((s) => !s.archived_at).length;
  const taskCount = (tasks.data ?? []).filter((t) => !t.done).length;

  return {
    plan,
    subjectCount,
    taskCount,
    canAddSubject: withinSubjectLimit(plan, subjectCount),
    canAddTask: withinTaskLimit(plan, taskCount),
    /** True → proceed; false → paywall shown. */
    gateSubject: (): boolean => {
      if (withinSubjectLimit(plan, subjectCount)) return true;
      router.push("/paywall");
      return false;
    },
    gateTask: (): boolean => {
      if (withinTaskLimit(plan, taskCount)) return true;
      router.push("/paywall");
      return false;
    },
  };
}
