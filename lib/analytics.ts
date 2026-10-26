// PostHog wrapper. posthog-js is initialised only when NEXT_PUBLIC_POSTHOG_KEY
// is set, and loaded with a dynamic import so it stays out of the bundle when it
// isn't. track() is safe to call either way.
//
// Events fired while the SDK is loading are held, up to MAX_PENDING, and sent
// when it arrives. This matters for `chat_permalink_opened`, which fires as soon
// as a fragment decodes, always before the SDK has loaded. With analytics off
// nothing is held.

import type { PostHog } from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let posthogInstance: PostHog | null = null;
let initStarted = false;

const MAX_PENDING = 20;
const pending: Array<[AnalyticsEvent, Record<string, unknown> | undefined]> = [];

// --- Application links: `?ref=` ---------------------------------------------
//
// One link per application, `?ref=<company>`, so PostHog can say which
// applications turned into visits (docs/application-links.md). The rules:
//
//   1. Never rendered. The value goes to PostHog and nowhere else. The repo is
//      public, so an allowlist of companies in the source would publish where
//      he has applied, and echoing URL text would let anyone make the page say
//      anything. evals/application-links.test.mjs holds this.
//   2. A slug or nothing: lowercase letters, digits and hyphens, 40 at most.
//      Anything else, like an email address, is dropped rather than cleaned up.
//   3. Read at landing, kept for the session. The query string doesn't survive
//      the visit (a link to /resume drops it, and a replayed fit check changes
//      the address before the SDK loads), so the value is read from the landing
//      address and registered as a session super property, which PostHog
//      attaches to every later event in the tab.
//   4. Also found after the fragment. `?ref=acme` appended to a copied
//      permalink lands inside `#c=…`, so it is read from there too, and
//      lib/permalink.ts ignores it when decoding the conversation.

/** The query parameter. Exported for the eval, not for the UI. */
export const REF_PARAM = "ref";

const REF_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/**
 * The application slug in a landing address, or null. Pure, so the eval can
 * test it without a browser. `hash` is searched only past its first `?` or `&`;
 * base64url contains neither, so that is always appended text.
 */
export function readRef(search: string, hash = ""): string | null {
  const fromQuery = new URLSearchParams(search).get(REF_PARAM);
  const tail = hash.search(/[?&]/);
  const fromHash =
    tail === -1 ? null : new URLSearchParams(hash.slice(tail + 1)).get(REF_PARAM);
  const value = (fromQuery ?? fromHash ?? "").trim().toLowerCase();
  return REF_SLUG.test(value) ? value : null;
}

// `undefined` until read, then the slug or null. Read once: the landing
// address is the only one guaranteed to still carry it.
let landingRef: string | null | undefined;

/**
 * Reads the ref off the address the visitor arrived at. The analytics provider
 * calls this on mount, before the shell can push a new address; init calls it
 * again in case nothing did.
 */
export function rememberLanding(): void {
  if (landingRef !== undefined || typeof window === "undefined") return;
  landingRef = readRef(window.location.search, window.location.hash);
}

function ensureInit(): void {
  if (initStarted) return;
  if (typeof window === "undefined") return;
  if (!POSTHOG_KEY) return; // analytics off — no network calls, no SDK fetch.
  initStarted = true;
  rememberLanding();
  import("posthog-js").then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      person_profiles: "identified_only",
      // A permalink's `#c=…` is the whole conversation, and the site's claim is
      // that it never reaches a server. By default posthog-js reports
      // `location.href`, fragment included, as `$current_url`,
      // `$session_entry_url` and `$initial_current_url`. This switch strips it
      // from those and from replay and heatmap URLs. The query string, and so
      // `?ref=`, is untouched; the site has no hash routes to lose.
      disable_capture_url_hashes: true,
      // Runs inside init, before the initial pageview is captured, so the
      // pageview carries the ref along with everything after it.
      loaded: (ph) => {
        if (landingRef) ph.register_for_session({ [REF_PARAM]: landingRef });
      },
    });
    posthogInstance = posthog;
    for (const [event, props] of pending.splice(0)) posthog.capture(event, props);
  });
}

// Called by components/analytics-provider.tsx once the page is idle. Safe
// no-op when the key is unset.
export function initAnalytics(): void {
  ensureInit();
}

// The event vocabulary; indented lines list an event's properties.
// `chat_turn_complete` and `chat_turn_failed` feed /measurements, which queries
// PostHog at build time (scripts/build-measurements.mjs), so they have to have
// been emitted for a while before that page has anything to show.
export type AnalyticsEvent =
  | "chat_message_sent"
  | "chat_error"
  | "chat_rate_limited"
  | "resume_download"
  // The HTML resume, opened from a CTA, so HTML opens can be compared with
  // PDF downloads.
  | "resume_open"
  | "contact_click"
  // The site stores nothing, so a copy or an export is the clearest signal
  // that an answer was worth keeping.
  | "chat_copy_message"
  | "chat_copy_conversation"
  // `kind` is file, print or mailto; a copied link or scorecard sends `chars`
  // instead.
  //   kind | chars
  | "chat_export"
  // A permalink was built. The length shows whether real links survive an
  // email client; `kind: "fit"` marks a short fit link.
  //   chars, kind
  | "chat_permalink_created"
  // Someone opened one. Links built against links opened is how use of the
  // feature is measured.
  //   messages
  | "chat_permalink_opened"
  // One per completed turn: the per-turn telemetry record.
  //   model, jd, ttft_ms, client_ttft_ms, duration_ms, tokens_per_second,
  //   input_tokens, cached_input_tokens, output_tokens, reasoning_tokens,
  //   cache_hit, cache_hit_ratio, steps, tools_called, finish_reason, stored
  //   (`stored`: a replayed answer to a fixed question; lib/stored-answers.ts)
  | "chat_turn_complete"
  // A failed turn with its error class, which tells "the model timed out"
  // apart from "the site is down".
  //   error_class, model, jd
  | "chat_turn_failed"
  // A failed turn sent again from the error block. Paired with
  // `chat_turn_failed`, it says whether the reader retried or left.
  //   model, switched
  | "chat_retry";

// Safe no-op when PostHog isn't configured. While the SDK is loading, the event
// is held and sent on arrival.
export function track(
  event: AnalyticsEvent,
  props?: Record<string, unknown>,
): void {
  ensureInit();
  if (posthogInstance) {
    posthogInstance.capture(event, props);
    return;
  }
  if (initStarted && pending.length < MAX_PENDING) pending.push([event, props]);
}
