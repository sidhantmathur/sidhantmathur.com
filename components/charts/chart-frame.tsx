import type { ModelRow } from "@/lib/model-comparison";

// The chrome every chart on /measurements/models wears (Sprint 8).
//
// Three charts and one raw-numbers table repeated the same three constructions
// between them — the scroll fade, the figure header, and the sentence naming
// what is missing — and the class strings in the first of those are not
// decorative. `4a8e22d` and `3bdb481` exist because a plot whose rightmost
// label sat flush against the edge looked like a plot that ended there, on the
// one device with no scrollbar to say otherwise. Four copies of a fix like that
// is three chances to lose it.
//
// WHY THE BREAKPOINTS ARE A TABLE RATHER THAN A PROP. The fade is gated on the
// container's width against the content's floor width — 520px of heatmap, 560px
// of scatter, 820px of table — so the number genuinely differs per instance. It
// cannot be interpolated: Tailwind emits a class by finding its literal text in
// the source, and `@[${n}px]:[mask-image:none]` is text no scanner will ever
// see. A missing mask does not break the build or the DOM; it just quietly
// stops fading. So the widths live here as a closed set of whole literal class
// strings, and adding a fourth width means adding a row rather than passing a
// number that silently does nothing.

const SCROLLABLE = {
  520: {
    fade: "overflow-x-auto [mask-image:linear-gradient(to_right,black_92%,transparent)] @[520px]:[mask-image:none]",
    floor: "min-w-[520px]",
  },
  560: {
    fade: "overflow-x-auto [mask-image:linear-gradient(to_right,black_92%,transparent)] @[560px]:[mask-image:none]",
    floor: "min-w-[560px]",
  },
  820: {
    fade: "overflow-x-auto [mask-image:linear-gradient(to_right,black_92%,transparent)] @[820px]:[mask-image:none]",
    floor: "min-w-[820px]",
  },
} as const;

/** The widths a chart is allowed to have. Add a row to SCROLLABLE to add one. */
export type FloorWidth = keyof typeof SCROLLABLE;

/**
 * The min-width for the content inside a `ScrollFade` of the same width.
 *
 * The two have to agree or the fade lies: it is present exactly when the
 * content is wider than the box, and that is only true when the content's floor
 * is the width the container query is testing.
 */
export function floorWidth(width: FloorWidth): string {
  return SCROLLABLE[width].floor;
}

/**
 * A horizontally scrolling box whose right edge fades while there is more.
 *
 * A query container rather than a breakpoint, because the fade is a lie when
 * there is nothing to scroll and the thing that decides that is this box's
 * width, not the window's — a media query would get it right on a phone and
 * wrong in any narrow column on a wide screen.
 */
export function ScrollFade({
  width,
  className,
  label,
  children,
}: {
  width: FloorWidth;
  /** Spacing for the scrolling box itself. */
  className?: string;
  /**
   * Names the box for a screen reader. A scrolling box is a tab stop in
   * Chrome, so the keyboard can reach it — and an unnamed stop announces
   * nothing. Given only where the content is long enough to be worth landing
   * on; the charts carry their own `role="img"` label instead.
   */
  label?: string;
  children: React.ReactNode;
}) {
  const region = label ? { role: "region", "aria-label": label, tabIndex: 0 } : {};
  return (
    <div className="@container">
      <div className={[className, SCROLLABLE[width].fade].filter(Boolean).join(" ")} {...region}>
        {children}
      </div>
    </div>
  );
}

/**
 * A figure, its heading, its note, and the sentence underneath about what is
 * not in it.
 *
 * The trailer slot is the third repetition: every chart here has models it
 * could not draw, and saying so in the same place in the same voice is the
 * difference between a chart that is missing a model and a chart that is
 * hiding one. (The heatmap's em dash is NOT this: it marks one cell a model
 * never ran, inside a chart the model does appear in, which is a per-cell fact
 * the trailer cannot carry.)
 */
export function ChartFrame({
  heading,
  note,
  measure,
  trailer,
  children,
}: {
  heading: string;
  /** What the number is and which direction is good. Sits under the heading. */
  note?: React.ReactNode;
  /**
   * Caps the note and trailer at a reading measure. The full-width charts want
   * it. The ranked panels sit two-up in a grid that is already narrower than
   * 62ch, so capping them would only move where they wrap in the one column
   * between 62ch and the grid's breakpoint.
   */
  measure?: boolean;
  /** Named models this chart left out, or anything else said after the mark. */
  trailer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const width = measure ? " max-w-[62ch]" : "";
  return (
    <figure className="m-0">
      <figcaption>
        <div className="t-meta font-medium text-text">{heading}</div>
        {note != null && (
          <div className={`t-meta mt-0.5${width} text-text-faint`}>{note}</div>
        )}
      </figcaption>
      {children}
      {trailer != null && (
        <p className={`t-meta mt-2${width} text-text-faint`}>{trailer}</p>
      )}
    </figure>
  );
}

/** "gpt-5-mini, gemini-3.5-flash" — models named in a trailer, never ids. */
export function shortNames(rows: ModelRow[]): string {
  return rows.map((row) => row.short).join(", ");
}
