// The A Darle 20 media and feature surface (#19, Track B).
//
// WHY THIS FILE IS A MANIFEST AND NOT A PAGE
//
// The decisions doc asks for screen recordings, video, screenshots and "the
// full feature surface" on this page, and Sidhant's line about it is that
// "there's a shit ton of features buried up there". Almost none of that exists
// as a file yet — one screenshot does, and it is the only asset in this repo.
//
// So the page ships the FRAMES rather than the media. Each slot below says what
// belongs in it, at what shape, and what the file has to show; a slot with no
// `asset` renders as a visibly empty frame that says so. Nothing here describes
// footage nobody has seen, and no `alt` text is written ahead of the file it
// describes — which is why `asset` carries `src` and `alt` together rather than
// as two optional fields. Adding one is dropping a file in `public/images` and
// filling in one object.
//
// The rule this enforces is the copy rule one level out from prose: a caption
// is a claim about something a visitor can check by looking. `docs/roadmap.md`
// Track B says do not fake a screenshot; this is the shape of not faking one.

export type MediaSlot = {
  id: string;
  kind: "screenshot" | "screen recording" | "video";
  /** Short title, shown above the frame whether or not the file exists. */
  title: string;
  /**
   * What the file must show, written for the person who has to capture it.
   * Rendered inside the empty frame, so the page's placeholder state IS the
   * brief — there is no second document to fall out of sync with.
   */
  brief: string;
  /** Intended shape, e.g. "16:9". Drives the frame's aspect ratio. */
  aspect: string;
  /** Tailwind aspect-ratio class matching `aspect`. */
  aspectClass: string;
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
    // The one asset that exists. Description written from the file itself.
    asset: {
      src: "/images/adarle20-listings.png",
      alt: "Three A Darle 20 session listing cards side by side, each with cover art, a title, tags, a weekly time, a price in Mexican pesos, the number of seats filled, and the host's name and review score.",
      caption:
        "Session listings. Each card carries the host, their rating, the price in pesos, the schedule and how many seats are still open.",
    },
  },
  {
    id: "booking",
    kind: "screen recording",
    title: "Booking a seat, end to end",
    brief:
      "One unbroken take from the listing page through checkout to the confirmation — the flow described under “what I built”, without cuts. Use a test account; no real player's name or email on screen.",
    aspect: "16:9",
    aspectClass: "aspect-video",
  },
  {
    id: "cash-payment",
    kind: "screenshot",
    title: "Paying in cash",
    brief:
      "The OXXO path at the point where a player is handed a payment reference to take to a convenience store. This is the part of the product nobody outside Mexico has seen, and it is the reason the payments section on this page is longer than the rest.",
    aspect: "9:16",
    aspectClass: "aspect-[9/16]",
  },
  {
    id: "host",
    kind: "screenshot",
    title: "What a host sees",
    brief:
      "A host's own view: their profile, their upcoming sessions, and their payouts. A test host account, not a real one.",
    aspect: "16:9",
    aspectClass: "aspect-video",
  },
  {
    id: "chat",
    kind: "screenshot",
    title: "Host and player chat",
    brief:
      "A conversation in the in-app chat, long enough to show it is a real thread rather than a contact form. Test accounts, or messages redacted.",
    aspect: "9:16",
    aspectClass: "aspect-[9/16]",
  },
  {
    id: "operations",
    kind: "screenshot",
    title: "The funnel, instrumented",
    brief:
      "Whatever you actually look at to run the business — bookings, conversion, cancellations, refunds, host activation. Check before sending: this is the one slot where the file would carry live numbers, and anything in it is published.",
    aspect: "16:9",
    aspectClass: "aspect-video",
  },
  {
    id: "convention",
    kind: "video",
    title: "The 251-player event",
    brief:
      "Footage or photographs from the flagship event at the convention. It is the largest single thing this platform has run and there is currently nothing on the site to show for it. A caption naming the event and the date will be written from whatever you send, not before.",
    aspect: "16:9",
    aspectClass: "aspect-video",
  },
];

// The feature surface.
//
// EVERY entry is a capability named in content/knowledge/projects-adarle20.md
// or in the resume, and `source` says which. This list is deliberately NOT a
// guess at what a marketplace probably has — a plausible feature is a factual
// claim about a product a hiring manager can go and use, which makes it exactly
// the kind of invention CLAUDE.md rules out. The gap between this list and the
// real product is recorded in FEATURE_SURFACE_NOTE rather than filled in.
export type Feature = {
  group: string;
  items: string[];
  source: string;
};

export const FEATURE_SURFACE: Feature[] = [
  {
    group: "Discovery",
    items: ["Host profiles", "Session listings"],
    source: "projects-adarle20.md",
  },
  {
    group: "Booking",
    items: ["Bookings and reservations", "Cancellations", "Automated refunds"],
    source: "projects-adarle20.md, resume.md",
  },
  {
    group: "Payments",
    items: [
      "Stripe Connect",
      "Host payouts",
      "Platform fees",
      "OXXO cash payments at a convenience store",
    ],
    source: "projects-adarle20.md, resume.md",
  },
  {
    group: "Communication",
    items: ["Real-time chat", "Transactional email on Resend"],
    source: "projects-adarle20.md",
  },
  {
    group: "Accounts",
    items: ["Authentication"],
    source: "projects-adarle20.md",
  },
  {
    group: "Operations",
    items: [
      "End-to-end funnel instrumentation — bookings, conversion, cancellations, refunds, host activation",
    ],
    source: "projects-adarle20.md, resume.md",
  },
];

export const FEATURE_SURFACE_NOTE =
  "This list is everything the written record names, which is not the same as everything the product does — [VERIFY: the features that exist in A Darle 20 but appear in no source file. Sidhant's own note on this page was that there is a lot buried up there; nothing can be added here until it is written down somewhere checkable.]";

export const MEDIA_SURFACE_NOTE =
  "Frames with nothing in them are waiting on a file. Each one says what it is for rather than showing a stand-in, because a placeholder that looks like a product is a claim about a product.";
