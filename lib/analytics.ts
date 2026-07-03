// PostHog wrapper. Initializes posthog-js ONLY when NEXT_PUBLIC_POSTHOG_KEY is
// set — no init call at all otherwise (not an init with a dummy key). Every call
// site can call track(...) safely regardless of whether PostHog is configured.

import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let initialized = false;

function ensureInit(): boolean {
  if (initialized) return true;
  if (typeof window === "undefined") return false;
  if (!POSTHOG_KEY) return false; // analytics off — no network calls at all.
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    person_profiles: "identified_only",
  });
  initialized = true;
  return true;
}

// Call once from a client component mounted in the app (e.g. the root layout's
// analytics provider) to trigger init on the client. Safe no-op when unset.
export function initAnalytics(): void {
  ensureInit();
}

export type AnalyticsEvent =
  | "chat_message_sent"
  | "chat_error"
  | "chat_rate_limited"
  | "resume_download"
  | "contact_click";

// Safe no-op when PostHog isn't configured.
export function track(
  event: AnalyticsEvent,
  props?: Record<string, unknown>,
): void {
  if (!ensureInit()) return;
  posthog.capture(event, props);
}
