// PostHog wrapper. Initializes posthog-js ONLY when NEXT_PUBLIC_POSTHOG_KEY is
// set — no init call at all otherwise (not an init with a dummy key). Every call
// site can call track(...) safely regardless of whether PostHog is configured.
//
// posthog-js is loaded via a lazy `import("posthog-js")` instead of a static
// import so it never lands in the shared/page JS bundle when analytics is off
// (the common case — no key set). The dynamic import only fires from inside
// the init path, and only when NEXT_PUBLIC_POSTHOG_KEY is present.
//
// Events fired before the async init resolves (or when analytics is off) are
// dropped, not queued — track() is fire-and-forget instrumentation, not a
// critical event log, so losing the rare event racing init is an acceptable
// trade for not shipping the SDK to every visitor.

import type { PostHog } from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let posthogInstance: PostHog | null = null;
let initStarted = false;

function ensureInit(): void {
  if (initStarted) return;
  if (typeof window === "undefined") return;
  if (!POSTHOG_KEY) return; // analytics off — no network calls, no SDK fetch.
  initStarted = true;
  import("posthog-js").then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      person_profiles: "identified_only",
    });
    posthogInstance = posthog;
  });
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

// Safe no-op when PostHog isn't configured, or when the SDK hasn't finished
// loading yet — events fired in that window are dropped (see note above).
export function track(
  event: AnalyticsEvent,
  props?: Record<string, unknown>,
): void {
  ensureInit();
  if (!posthogInstance) return;
  posthogInstance.capture(event, props);
}
