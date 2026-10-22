import Image from "next/image";
import { ADARLE_MEDIA, FEATURE_SURFACE, type MediaSlot } from "@/content/adarle20-media";

// The A Darle 20 media and feature surface (#19): two pre-rendered sections
// appended below the case study, screenshot first. They sit in the case
// study's own rhythm (no rule, the same gap as an MDX section) so the page
// reads as one document rather than a story with an appendix.
//
// Only slots with a file render; an empty frame on the flagship case study
// reads as unfinished work. The capture briefs for the rest stay in
// content/adarle20-media.ts and the copy ledger, and a slot appears here once
// its `asset` is filled in.
//
// FEATURE_SURFACE_NOTE carries a `[VERIFY]` marker, so it stays off the page
// until the missing features are written down. evals/track-b.test.mjs fails if
// this component renders it, and scripts/check-rendered-markers.mjs fails the
// build if any marker reaches the served output.

export function AdarleFeatureSurface() {
  // One line per area: the case study above already tells each of these, so
  // the list is an index, not a second telling.
  return (
    <section className="mt-8">
      <h2 className="t-head font-medium text-text">What&apos;s in it</h2>
      <dl className="t-body mt-3 max-w-[68ch] space-y-1.5 sm:space-y-1">
        {FEATURE_SURFACE.map((group) => (
          <div key={group.group} className="sm:grid sm:grid-cols-[8rem_1fr] sm:gap-x-4">
            <dt className="t-label pt-[3px] text-text-faint">{group.group}</dt>
            <dd className="text-text-soft [font-family:var(--font-geist-sans)]">
              {group.items.join(" · ")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

type CapturedSlot = MediaSlot & { asset: NonNullable<MediaSlot["asset"]> };

export function AdarleMediaSurface() {
  const captured = ADARLE_MEDIA.filter((slot): slot is CapturedSlot => slot.asset != null);
  if (!captured.length) return null;
  return (
    <section className="mt-8">
      <h2 className="t-head font-medium text-text">What it looks like</h2>
      <div className="mt-3 space-y-8">
        {captured.map((slot) => (
          <MediaFrame key={slot.id} slot={slot} titled={captured.length > 1} />
        ))}
      </div>
    </section>
  );
}

// With one file the section heading names it, so the frame carries no title of
// its own; once a second slot is filled, each frame is titled.
function MediaFrame({ slot, titled }: { slot: CapturedSlot; titled: boolean }) {
  const width = slot.width === "narrow" ? "max-w-[300px]" : "max-w-[68ch]";
  return (
    <figure className={width}>
      {titled && <div className="t-meta mb-2 text-text-soft">{slot.title}</div>}
      <div className={`relative border border-line ${slot.aspectClass}`}>
        <Image
          src={slot.asset.src}
          alt={slot.asset.alt}
          fill
          sizes="(max-width: 768px) 100vw, 68ch"
          className="object-cover object-top"
        />
      </div>
      <figcaption className="t-meta mt-2 max-w-[62ch] text-text-faint">
        {slot.asset.caption}
      </figcaption>
    </figure>
  );
}
