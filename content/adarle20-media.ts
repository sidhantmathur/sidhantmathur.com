// The A Darle 20 media and feature surface (#19), as a manifest rendered by
// components/project-media.tsx.
//
// Each media slot says what belongs in it, at what shape, and what the file
// has to show. Only a slot with an `asset` renders; the rest are capture
// briefs, kept here and in the copy ledger until a file exists. Adding one is
// dropping a file in public/images and filling in `asset`.
//
// A caption is a claim a visitor can check by looking, so nothing here
// describes footage nobody has seen.

export type MediaSlot = {
  id: string;
  kind: "screenshot" | "screen recording" | "video";
  /** Short title, shown above the frame. */
  title: string;
  /**
   * What the file must show, written for the person who has to capture it.
   * Not rendered: it is the brief for a slot that has no file yet.
   */
  brief: string;
  /** Intended shape, e.g. "16:9". Drives the frame's aspect ratio. */
  aspect: string;
  /** Tailwind aspect-ratio class matching `aspect`. */
  aspectClass: string;
  /**
   * How wide the frame is allowed to get. A phone screenshot at full column
   * width would be over 1,100px tall, so portrait slots are capped and
   * everything else fills the column.
   */
  width: "column" | "narrow";
  /**
   * Present only when a real file exists. `alt` travels with `src` so a file
   * can never be added without describing it, and a description can never be
   * written ahead of the file.
   */
  asset?: { src: string; alt: string; caption: string };
};

export const ADARLE_MEDIA: MediaSlot[] = [
  {
    id: "listings",
    kind: "screenshot",
    title: "Session listings",
    brief:
      "The browse page a player lands on: several sessions side by side, each with its host, price, time and remaining seats.",
    aspect: "152:69",
    aspectClass: "aspect-[152/69]",
    width: "column",
    // Alt text and caption written from the file itself.
    asset: {
      src: "/images/adarle20-listings.png",
      alt: "Three A Darle 20 session listing cards side by side, each with cover art, a title, tags, a weekly time, a price in Mexican pesos, the number of seats filled, and the host's name and review score.",
      caption:
        "Each card shows the host and their rating, the price in pesos, the schedule, and how many seats are filled.",
    },
  },
  {
    id: "reservation",
    kind: "screen recording",
    title: "Reserving a place, end to end",
    brief:
      "One unbroken take from the listing page through checkout to the confirmation, without cuts. Use a test account; no real player's name or email on screen.",
    aspect: "16:9",
    aspectClass: "aspect-video",
    width: "column",
  },
  {
    id: "host",
    kind: "screenshot",
    title: "What a host sees",
    brief:
      "A host's own view: their profile, their upcoming sessions, and their payouts. A test host account, not a real one.",
    aspect: "16:9",
    aspectClass: "aspect-video",
    width: "column",
  },
  {
    id: "chat",
    kind: "screenshot",
    title: "Host and player chat",
    brief:
      "A conversation in the in-app chat, long enough to show it is a real thread rather than a contact form. Test accounts, or messages redacted.",
    aspect: "9:16",
    aspectClass: "aspect-[9/16]",
    width: "narrow",
  },
  {
    id: "operations",
    kind: "screenshot",
    title: "Funnel tracking",
    brief:
      "Whatever you actually look at to run the business — conversion, refunds, host activation. Check before sending: this is the one slot where the file would carry live numbers, and anything in it is published.",
    aspect: "16:9",
    aspectClass: "aspect-video",
    width: "column",
  },
  {
    id: "convention",
    kind: "video",
    title: "The 251-player event",
    brief:
      "Footage or photographs from the flagship event at the convention. It is the largest single thing this platform has run and there is currently nothing on the site to show for it. A caption naming the event and the date will be written from whatever you send, not before.",
    aspect: "16:9",
    aspectClass: "aspect-video",
    width: "column",
  },
];

// The feature surface. Every entry is a capability named in the master
// resume (content/knowledge/resume.md) or the A Darle 20 knowledge file built
// from it, and `source` says which. The 2026-10-26 resume sync cut the entries
// the master doesn't name (host profiles, cancellations, chat, authentication,
// cash payments); they come back when Sidhant writes them down. It is not a guess at what a marketplace probably has: a plausible
// feature is a factual claim about a product a hiring manager can go and use.
// The gap between this list and the real product is recorded in
// FEATURE_SURFACE_NOTE rather than filled in.
//
// It renders as one line per area (gauntlet pass, 2026-10-22). Decision #19
// asks for the full feature surface, so the list stays; but every item is
// already told in the case study above it, and a two-column grid of single
// words was the longest block on the page. Item text is kept short for the
// same reason: the prose carries the detail.
export type Feature = {
  group: string;
  items: string[];
  source: string;
};

export const FEATURE_SURFACE: Feature[] = [
  {
    group: "Marketplace",
    items: ["Session listings", "Session reservations"],
    source: "projects-adarle20.md, resume.md",
  },
  {
    group: "Payments",
    items: ["Stripe Connect", "Refunds"],
    source: "resume.md",
  },
  {
    group: "Email",
    items: ["Resend"],
    source: "resume.md",
  },
  {
    group: "Operations",
    items: ["Funnel instrumentation", "Host activation", "PostHog"],
    source: "resume.md",
  },
];

// Not rendered while it carries a `[VERIFY]` marker. It is the draft the
// ledger's pending row points at; once the missing features are written into
// content/knowledge/, the marker goes and the sentence can go on the page.
export const FEATURE_SURFACE_NOTE =
  "These are the features written down so far, and the product has more. [VERIFY: the features that exist in A Darle 20 but appear in no source file. Sidhant's own note on this page was that there is a lot buried up there; nothing can be added here until it is written down somewhere checkable.]";

