import { AppState, Platform } from "react-native";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { kv } from "@/lib/storage";

/**
 * Supabase client. Keys come from EXPO_PUBLIC_* env (publishable anon key
 * only — privileged keys never ship in the client, spec §10).
 *
 * When env is absent the app still runs: guest/demo mode is fully local and
 * auth screens surface a friendly "no server configured" path.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        storage: {
          getItem: (key) => kv.getItem(key),
          setItem: (key, value) => kv.setItem(key, value),
          removeItem: (key) => kv.removeItem(key),
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === "web",
      },
    })
  : null;

// Keep token refresh alive while the app is foregrounded (native).
if (supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Normalise emails before every auth call (spec §5). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
