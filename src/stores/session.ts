import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "@/lib/storage";

/**
 * Who is using the app right now.
 *
 * - "signedOut": show the welcome/auth flow
 * - "guest": demo mode — fully local data, no Supabase writes (spec §7.18)
 * - "authed": Supabase session active; `userId` set
 */
export type SessionMode = "signedOut" | "guest" | "authed";

interface SessionState {
  mode: SessionMode;
  userId: string | null;
  email: string | null;
  /** Guest-mode onboarding completion (authed users use profiles.onboarded_at). */
  guestOnboarded: boolean;
  enterGuest: () => void;
  setAuthed: (userId: string, email: string | null) => void;
  signOut: () => void;
  setGuestOnboarded: (done: boolean) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      mode: "signedOut",
      userId: null,
      email: null,
      guestOnboarded: false,
      enterGuest: () => set({ mode: "guest", userId: null, email: null }),
      setAuthed: (userId, email) => set({ mode: "authed", userId, email }),
      signOut: () => set({ mode: "signedOut", userId: null, email: null }),
      setGuestOnboarded: (guestOnboarded) => set({ guestOnboarded }),
    }),
    {
      name: "markd.session",
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
