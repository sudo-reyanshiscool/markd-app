import { Platform } from "react-native";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/**
 * Purchase adapter (spec §9):
 * - native → RevenueCat SDK when its native module exists (EAS builds)
 * - web → Stripe Checkout via the stripe-webhook function's GET actions
 * - anything unconfigured → "unavailable" so the paywall explains itself
 *
 * RevenueCat entitlements remain the source of truth; the server webhooks
 * mirror them into profiles.plan, which the app reads.
 */

export type PurchaseOption = "pro_monthly" | "pro_yearly" | "family_yearly";
export type PurchaseResult = "success" | "cancelled" | "unavailable";

const RC_API_KEY =
  Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

type RCModule = {
  default: {
    configure: (opts: { apiKey: string; appUserID?: string }) => void;
    getOfferings: () => Promise<{
      current: { availablePackages: { identifier: string; product: { identifier: string } }[] } | null;
    }>;
    purchasePackage: (pkg: unknown) => Promise<unknown>;
    restorePurchases: () => Promise<unknown>;
  };
};

function loadRC(): RCModule["default"] | null {
  if (Platform.OS === "web" || !RC_API_KEY) return null;
  try {
    const mod = require("react-native-purchases") as RCModule;
    return mod.default;
  } catch {
    return null; // Expo Go — native module absent
  }
}

let rcConfigured = false;

export function purchasesAvailable(): boolean {
  if (Platform.OS === "web") return isSupabaseConfigured;
  return loadRC() !== null;
}

export async function configurePurchases(userId: string | null): Promise<void> {
  const rc = loadRC();
  if (!rc || rcConfigured) return;
  try {
    rc.configure({ apiKey: RC_API_KEY!, appUserID: userId ?? undefined });
    rcConfigured = true;
  } catch {
    // never block the app on store config
  }
}

const RC_PACKAGE_FOR_OPTION: Record<PurchaseOption, string> = {
  pro_monthly: "$rc_monthly",
  pro_yearly: "$rc_annual",
  family_yearly: "family_yearly",
};

export async function purchase(option: PurchaseOption): Promise<PurchaseResult> {
  if (Platform.OS === "web") {
    if (!supabase) return "unavailable";
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return "unavailable";
    const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/stripe-webhook?action=create-checkout&price=${option}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return "unavailable";
    const body = (await res.json()) as { url?: string };
    if (!body.url) return "unavailable";
    globalThis.location?.assign(body.url);
    return "success";
  }

  const rc = loadRC();
  if (!rc) return "unavailable";
  try {
    if (!rcConfigured) await configurePurchases(null);
    const offerings = await rc.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      (p) =>
        p.identifier === RC_PACKAGE_FOR_OPTION[option] ||
        p.product.identifier.includes(option),
    );
    if (!pkg) return "unavailable";
    await rc.purchasePackage(pkg);
    return "success";
  } catch (e) {
    const err = e as { userCancelled?: boolean };
    if (err.userCancelled) return "cancelled";
    return "unavailable";
  }
}

export async function restorePurchases(): Promise<void> {
  const rc = loadRC();
  if (!rc) return;
  try {
    await rc.restorePurchases();
  } catch {
    // surfaced via entitlement refresh; nothing to throw at the UI
  }
}

/** Web: open the Stripe billing portal. */
export async function openBillingPortal(): Promise<boolean> {
  if (!supabase) return false;
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return false;
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/stripe-webhook?action=billing-portal`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return false;
  const body = (await res.json()) as { url?: string };
  if (!body.url) return false;
  if (Platform.OS === "web") globalThis.location?.assign(body.url);
  else {
    const WebBrowser = require("expo-web-browser") as typeof import("expo-web-browser");
    await WebBrowser.openBrowserAsync(body.url);
  }
  return true;
}
