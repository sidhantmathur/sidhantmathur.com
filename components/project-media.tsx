import Image from "next/image";
import { ADARLE_MEDIA, FEATURE_SURFACE, type MediaSlot } from "@/content/adarle20-media";

// The A Darle 20 media and feature surface (#19): two pre-rendered sections
// appended below the case study.
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
  return (
    <section className="mt-12 border-t border-line pt-8">
      <h2 className="t-head font-medium text-text">
        Everything in it
      </h2>
      <p className="t-body mt-3 max-w-[68ch] text-text-soft">
        The prose above is the story. This is the surface area — what a host or a
        player can actually do.
      </p>
      <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {FEATURE_SURFACE.map((group) => (
          <div key={group.group}>
            <dt className="t-label text-text-faint">{group.group}</dt>
            <dd>
              <ul className="t-body mt-1.5 space-y-1 text-text-soft">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
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
    <section className="mt-12 border-t border-line pt-8">
      <h2 className="t-head font-medium text-text">
        What it looks like
      </h2>
      <div className="mt-6 space-y-8">
        {captured.map((slot) => (
          <MediaFrame key={slot.id} slot={slot} />
        ))}
      </div>
    </section>
  );
}

function MediaFrame({ slot }: { slot: CapturedSlot }) {
  const width = slot.width === "narrow" ? "max-w-[300px]" : "max-w-[68ch]";
  return (
    <figure className={width}>
      <div className="t-meta flex items-baseline justify-between gap-3">
        <span className="text-text-soft">{slot.title}</span>
        <span className="shrink-0 text-text-faint">
          {slot.kind} · {slot.aspect}
        </span>
      </div>
      <div className={`relative mt-2 border border-line ${slot.aspectClass}`}>
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
