import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/stores/session";

import { fetchProfile, ProfileRow } from "./api";

/** Subscribe once to Supabase auth changes and mirror them into the store. */
export function useAuthListener(): void {
  const setAuthed = useSessionStore((s) => s.setAuthed);
  const signOut = useSessionStore((s) => s.signOut);
  const mode = useSessionStore((s) => s.mode);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthed(session.user.id, session.user.email ?? null);
      } else if (useSessionStore.getState().mode === "authed") {
        signOut();
        queryClient.clear();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [setAuthed, signOut, queryClient]);

  // Restore an existing session on cold start.
  useEffect(() => {
    if (!supabase || mode === "guest") return;
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setAuthed(data.session.user.id, data.session.user.email ?? null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** The signed-in user's profile row (authed mode only). */
export function useProfile() {
  const mode = useSessionStore((s) => s.mode);
  const userId = useSessionStore((s) => s.userId);
  return useQuery<ProfileRow | null>({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId!),
    enabled: mode === "authed" && Boolean(userId),
    staleTime: 30_000,
  });
}

export interface GateState {
  ready: boolean;
  showAuth: boolean;
  showOnboarding: boolean;
  showApp: boolean;
}

/**
 * Routing gate (spec §5): signed out → auth; authed/guest without onboarding
 * → onboarding; otherwise the app.
 */
export function useGateState(): GateState {
  const mode = useSessionStore((s) => s.mode);
  const guestOnboarded = useSessionStore((s) => s.guestOnboarded);
  const profile = useProfile();

  if (mode === "signedOut") {
    return { ready: true, showAuth: true, showOnboarding: false, showApp: false };
  }
  if (mode === "guest") {
    return {
      ready: true,
      showAuth: false,
      showOnboarding: !guestOnboarded,
      showApp: guestOnboarded,
    };
  }
  // authed — wait for the profile before deciding (splash stays up)
  if (profile.isPending) {
    return { ready: false, showAuth: false, showOnboarding: false, showApp: false };
  }
  const onboarded = Boolean(profile.data?.onboarded_at);
  return {
    ready: true,
    showAuth: false,
    showOnboarding: !onboarded,
    showApp: onboarded,
  };
}
