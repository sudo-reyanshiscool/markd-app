import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "@/lib/storage";

/** Notification preferences (spec §7.20: respect per-user preferences). */
interface PrefsState {
  plannerPing: boolean;
  deadlineReminders: boolean;
  streakSaver: boolean;
  set: (patch: Partial<Pick<PrefsState, "plannerPing" | "deadlineReminders" | "streakSaver">>) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      plannerPing: false,
      deadlineReminders: true,
      streakSaver: true,
      set: (patch) => set(patch),
    }),
    {
      name: "markd.prefs",
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
