import { useConsentStore } from "@/stores/consent";

/**
 * Sentry (errors) + PostHog (opt-in analytics). Both no-op without keys so
 * the app runs keyless in dev; both read env only — no secrets in source.
 */
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let posthogClient: { capture: (e: string, p?: Record<string, unknown>) => void; optIn?: () => void } | null = null;
let sentryInited = false;

export function initObservability(): void {
  if (SENTRY_DSN && !sentryInited) {
    try {
      const Sentry = require("@sentry/react-native") as typeof import("@sentry/react-native");
      Sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: 0.2,
        enableNativeCrashHandling: true,
        sendDefaultPii: false,
      });
      sentryInited = true;
    } catch {
      // Sentry native module unavailable (e.g. Expo Go) — skip silently.
    }
  }
}

/** Call after consent flips to opted-in (and on app start when already in). */
export function initAnalyticsIfConsented(): void {
  const { optedIn } = useConsentStore.getState();
  if (!optedIn || !POSTHOG_KEY || posthogClient) return;
  try {
    const PostHog = require("posthog-react-native").default;
    posthogClient = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST });
  } catch {
    posthogClient = null;
  }
}

/** Track an event — silently dropped unless the user opted in. */
export function track(event: string, props?: Record<string, unknown>): void {
  const { optedIn } = useConsentStore.getState();
  if (!optedIn) return;
  if (!posthogClient) initAnalyticsIfConsented();
  posthogClient?.capture(event, props);
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!sentryInited) return;
  try {
    const Sentry = require("@sentry/react-native") as typeof import("@sentry/react-native");
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // never let telemetry crash the app
  }
}
