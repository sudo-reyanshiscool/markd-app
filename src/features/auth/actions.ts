import { Platform } from "react-native";

import { isSupabaseConfigured, normalizeEmail, supabase } from "@/lib/supabase";
import { useSessionStore } from "@/stores/session";

export class AuthUnavailableError extends Error {
  constructor() {
    super("Supabase is not configured");
    this.name = "AuthUnavailableError";
  }
}

function requireClient() {
  if (!supabase) throw new AuthUnavailableError();
  return supabase;
}

export async function signInWithPassword(email: string, password: string) {
  const client = requireClient();
  const { error } = await client.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });
  if (error) throw error;
}

export async function signUpWithPassword(email: string, password: string) {
  const client = requireClient();
  const { error } = await client.auth.signUp({
    email: normalizeEmail(email),
    password,
  });
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const client = requireClient();
  const { error } = await client.auth.resetPasswordForEmail(
    normalizeEmail(email),
    { redirectTo: "markd://reset" },
  );
  if (error) throw error;
}

/** Sign in with Apple — iOS only (spec §5). */
export async function signInWithApple() {
  if (Platform.OS !== "ios") throw new Error("Apple sign-in is iOS-only");
  const client = requireClient();
  const AppleAuthentication =
    require("expo-apple-authentication") as typeof import("expo-apple-authentication");
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) throw new Error("No identity token from Apple");
  const { error } = await client.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
  });
  if (error) throw error;
}

export async function signOutEverywhere() {
  if (supabase) await supabase.auth.signOut().catch(() => {});
  useSessionStore.getState().signOut();
}

export { isSupabaseConfigured };
