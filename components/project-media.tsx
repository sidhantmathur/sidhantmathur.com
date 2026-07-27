import Image from "next/image";
import {
  ADARLE_MEDIA,
  FEATURE_SURFACE,
  FEATURE_SURFACE_NOTE,
  MEDIA_SURFACE_NOTE,
  type MediaSlot,
} from "@/content/adarle20-media";

// The A Darle 20 media and feature surface (#19, Track B).
//
// Two sections appended below the case study. Both are pre-rendered — nothing
// here fetches, and an empty slot is a static frame, not a loading state.
//
// The empty frame is the whole point of this component. It is drawn as a
// dashed outline at the shape the real asset will be, carrying the brief for
// whoever has to capture it, and it says "nothing here yet" in words. It must
// never be mistaken for a screenshot: no blurred mock, no grey rectangle that
// reads as a broken image, no caption in the past tense.

export function AdarleFeatureSurface() {
  return (
    <section className="mt-12 border-t border-line pt-8">
      <h2 className="text-[15px] font-medium tracking-tight text-text">
        Everything in it
      </h2>
      <p className="mt-3 max-w-[68ch] text-[13px] leading-[1.7] text-text-soft">
        The prose above is the story. This is the surface area — what a host or a
        player can actually do.
      </p>
      <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {FEATURE_SURFACE.map((group) => (
          <div key={group.group}>
            <dt className="text-[11px] text-text-faint">{group.group}</dt>
            <dd>
              <ul className="mt-1.5 space-y-1 text-[13px] leading-[1.6] text-text-soft">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 max-w-[68ch] text-[11px] leading-[1.7] text-text-faint">
        {FEATURE_SURFACE_NOTE}
      </p>
    </section>
  );
}

export function AdarleMediaSurface() {
  return (
    <section className="mt-12 border-t border-line pt-8">
      <h2 className="text-[15px] font-medium tracking-tight text-text">
        What it looks like
      </h2>
      <p className="mt-3 max-w-[68ch] text-[13px] leading-[1.7] text-text-soft">
        {MEDIA_SURFACE_NOTE}
      </p>
      <div className="mt-6 space-y-8">
        {ADARLE_MEDIA.map((slot) => (
          <MediaFrame key={slot.id} slot={slot} />
        ))}
      </div>
    </section>
  );
}

function MediaFrame({ slot }: { slot: MediaSlot }) {
  const width = slot.width === "narrow" ? "max-w-[300px]" : "max-w-[68ch]";
  return (
    <figure className={width}>
      <div className="flex items-baseline justify-between gap-3 text-[11px]">
        <span className="text-text-soft">{slot.title}</span>
        <span className="shrink-0 text-text-faint">
          {slot.kind} · {slot.aspect}
        </span>
      </div>

      {slot.asset ? (
        <div className={`relative mt-2 border border-line ${slot.aspectClass}`}>
          <Image
            src={slot.asset.src}
            alt={slot.asset.alt}
            fill
            sizes="(max-width: 768px) 100vw, 68ch"
            className="object-cover object-top"
          />
        </div>
      ) : (
        // Dashed, empty, and labelled. Deliberately NOT a filled rectangle:
        // a solid grey block at a screenshot's shape reads as an image that
        // failed to load, which is a worse lie than an obvious hole.
        <div
          className={`mt-2 flex flex-col justify-center gap-2 border border-dashed border-line-strong px-4 py-4 ${slot.aspectClass}`}
        >
          <span className="text-[11px] text-text-faint">
            Nothing here yet — waiting on a {slot.kind}.
          </span>
          <p className="max-w-[52ch] text-[12px] leading-[1.6] text-text-soft">
            {slot.brief}
          </p>
        </div>
      )}

      <figcaption className="mt-2 max-w-[62ch] text-[11px] leading-[1.6] text-text-faint">
        {slot.asset ? slot.asset.caption : `${slot.title} — not captured yet.`}
      </figcaption>
    </figure>
  );
}
