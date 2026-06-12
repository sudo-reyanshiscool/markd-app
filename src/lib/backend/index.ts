import { useMemo } from "react";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/stores/session";

import { localBackend } from "./local";
import { SupabaseBackend } from "./remote";
import { Backend } from "./types";

export * from "./types";
export { localBackend, LocalBackend } from "./local";
export { SupabaseBackend } from "./remote";

/**
 * The active backend for the current session mode. Guest (and signed-out
 * edge states) read the device-local store; authed reads Supabase.
 */
export function useBackend(): Backend {
  const mode = useSessionStore((s) => s.mode);
  const userId = useSessionStore((s) => s.userId);
  return useMemo<Backend>(() => {
    if (mode === "authed" && userId && supabase) {
      return new SupabaseBackend(supabase, userId);
    }
    return localBackend;
  }, [mode, userId]);
}

/** Query-key scope so guest and each user never share cache entries. */
export function useDataScope(): string {
  const mode = useSessionStore((s) => s.mode);
  const userId = useSessionStore((s) => s.userId);
  return mode === "authed" && userId ? `u:${userId}` : "guest";
}
