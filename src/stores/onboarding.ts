import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { ExamTrack } from "@/db/schemas";
import { zustandStorage } from "@/lib/storage";

/**
 * Onboarding draft (spec §6): persisted so back/forward navigation — and
 * even an app restart — keeps the answers.
 */
interface OnboardingDraft {
  name: string;
  schoolId: string | null;
  schoolName: string | null;
  country: string;
  track: ExamTrack | null;
  yearGroup: string | null;
  subjectName: string;
  subjectColor: string;

  set: (patch: Partial<Omit<OnboardingDraft, "set" | "reset">>) => void;
  reset: () => void;
}

const initial = {
  name: "",
  schoolId: null,
  schoolName: null,
  country: "",
  track: null,
  yearGroup: null,
  subjectName: "",
  subjectColor: "volt",
};

export const useOnboardingStore = create<OnboardingDraft>()(
  persist(
    (set) => ({
      ...initial,
      set: (patch) => set(patch),
      reset: () => set(initial),
    }),
    {
      name: "markd.onboarding",
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
