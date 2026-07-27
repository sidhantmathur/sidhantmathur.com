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

// The event vocabulary.
//
// Widened in roadmap Sprint 1 (F3) ahead of the panel that consumes it (#23,
// Sprint 6). That panel aggregates PostHog history at BUILD time, so the
// emitters have to have been running for weeks before it has anything to show
// — shipping the events early and the panel late is the whole point of putting
// F3 in this sprint rather than that one.
export type AnalyticsEvent =
  | "chat_message_sent"
  | "chat_error"
  | "chat_rate_limited"
  | "resume_download"
  | "contact_click"
  // Copy-to-clipboard. Worth measuring: the site stores nothing, so a copy is
  // the clearest signal that an answer was considered worth keeping.
  | "chat_copy_message"
  | "chat_copy_conversation"
  // The export surface (Sprint 5, #17). `kind` says which handle was pulled —
  // file, print, mailto, or a copied link. Same reasoning as the copy events:
  // the site stores nothing, so an export is the clearest signal that the
  // conversation was worth keeping.
  //   kind, chars
  | "chat_export"
  // A permalink was built. The character count travels with it, because
  // whether real conversations produce links that survive an email client is a
  // measurement, not the estimate in docs/idea-decisions.md.
  //   chars
  | "chat_permalink_created"
  // Someone opened one. The counterpart to the event above: links built vs
  // links followed is the only way to find out whether this feature is used.
  //   messages
  | "chat_permalink_opened"
  // One event per completed turn, carrying the F1 telemetry record. This is
  // what #23's latency and reliability panel is built from.
  //   model, tier, jd, ttft_ms, duration_ms, tokens_per_second,
  //   input_tokens, cached_input_tokens, output_tokens, cache_hit,
  //   cache_hit_ratio, steps, tools_called, finish_reason
  | "chat_turn_complete"
  // A turn that failed with a class attached — the reliability half of #23,
  // and the difference between "the site is down" and "the model timed out".
  //   error_class, model, tier, jd
  | "chat_turn_failed";

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
