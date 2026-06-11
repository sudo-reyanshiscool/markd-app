import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "@/lib/storage";

/**
 * Analytics consent (spec §10): no third-party tracking before explicit
 * opt-in. `asked` gates the one-time dialog; `optedIn` gates PostHog.
 */
interface ConsentState {
  asked: boolean;
  optedIn: boolean;
  decide: (optedIn: boolean) => void;
  /** Settings can re-open the choice. */
  reset: () => void;
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      asked: false,
      optedIn: false,
      decide: (optedIn) => set({ asked: true, optedIn }),
      reset: () => set({ asked: false, optedIn: false }),
    }),
    {
      name: "markd.consent",
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
