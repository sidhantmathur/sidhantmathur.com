// PostHog wrapper. Initializes posthog-js ONLY when NEXT_PUBLIC_POSTHOG_KEY is
// set — no init call at all otherwise (not an init with a dummy key). Every call
// site can call track(...) safely regardless of whether PostHog is configured.
//
// posthog-js is loaded via a lazy `import("posthog-js")` instead of a static
// import so it never lands in the shared/page JS bundle when analytics is off
// (the common case — no key set). The dynamic import only fires from inside
// the init path, and only when NEXT_PUBLIC_POSTHOG_KEY is present.
//
// Events fired while the SDK is still loading are HELD, up to a small cap, and
// sent once it arrives. They used to be dropped, on the theory that losing the
// rare event racing init was cheap. It was not rare for the event application
// links depend on: `chat_permalink_opened` fires the moment a fragment
// decodes, which is always before the SDK has loaded, so every opened link was
// lost. When analytics is off nothing is held — there is nothing to send it to.

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
// Sidhant sends one link per application, `?ref=<company>`, so PostHog can say
// which applications turned into visits. docs/application-links.md is the
// routine. Four rules keep it to counting and nothing else:
//
//   1. NEVER RENDERED. The value goes to PostHog and nowhere else: no greeting,
//      no "welcome, Acme". The repo is public, so an allowlist of companies in
//      the source would publish who he has applied to, and echoing text from
//      the URL would let anyone make the page say anything.
//      evals/application-links.test.mjs holds this.
//   2. A SLUG OR NOTHING. Lowercase letters, digits and hyphens, 40 at most. An
//      email address or a name with a space in it is dropped, not cleaned up:
//      the convention is a company slug, and anything else goes untracked.
//   3. READ AT LANDING, KEPT FOR THE SESSION. The query string does not survive
//      the visit — a link to /resume drops it, and a replayed fit check opens
//      its panel within milliseconds of loading, well before the SDK arrives.
//      So the value is read from the address the visitor landed on and
//      registered as a SESSION super property, which PostHog attaches to every
//      later event in the tab whatever the address bar says by then.
//   4. FOUND AFTER THE FRAGMENT TOO. Appending `?ref=acme` to a copied
//      permalink puts it after `#c=…`, inside the fragment. That is the natural
//      way to get it wrong, so it is read from there as well, and
//      lib/permalink.ts ignores it when decoding the conversation.

/** The query parameter. Exported for the eval, not for the UI. */
export const REF_PARAM = "ref";

const REF_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/**
 * The application slug in a landing address, or null.
 *
 * Pure, so the eval can hold the rules above without a browser. `hash` is
 * searched only past its first `?` or `&` — base64url never contains either,
 * so that is always text someone appended, never part of a payload.
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
 * Reads the ref off the address the visitor arrived at. Called on mount by the
 * analytics provider, before anything in the shell can push a new address, and
 * again (harmlessly) by init in case nothing called it first.
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
      // THE FRAGMENT STAYS IN THE BROWSER. A permalink's `#c=…` is the whole
      // conversation — a pasted posting, the assessment, every answer — and
      // the site's claim is that it never reaches a server. By default
      // posthog-js reports `location.href`, fragment included, as
      // `$current_url`, `$session_entry_url` and `$initial_current_url`, so with
      // analytics on, every opened link was uploaded to PostHog. This is the
      // SDK's own switch for all of those, and for replay and heatmap URLs.
      // The query string, and so `?ref=`, is untouched; the site has no hash
      // routes to lose.
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
  // The HTML resume, opened from a CTA. Its own event so the PDF-or-HTML
  // question the council left open can be answered from real clicks.
  | "resume_open"
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
  | "chat_turn_failed"
  // A failed turn was sent again from the error block. Paired with
  // `chat_turn_failed` it answers the only question that matters about the
  // failure copy: did the reader try again, or did they leave.
  //   model
  | "chat_retry";

// Safe no-op when PostHog isn't configured. While the SDK is still loading the
// event is held and sent on arrival (see the note at the top).
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
