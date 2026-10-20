import type { ModelRow } from "@/lib/model-comparison";

// Shared chrome for the charts and the raw-numbers table on
// /measurements/models: the scroll fade, the figure header, and the sentence
// naming what is missing. The fade matters on touch devices with no visible
// scrollbar, where a plot whose last label sits flush against the edge looks
// like it ends there.
//
// The breakpoints are a table rather than a prop. The fade is gated on the
// container's width against the content's floor width (520px of heatmap,
// 560px of scatter, 820px of table), and the width can't be interpolated:
// Tailwind emits a class only when it finds its literal text in the source, so
// `@[${n}px]:[mask-image:none]` would silently compile to nothing. Adding a
// width means adding a row.

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
 * A container query rather than a media query, because whether there is more
 * to scroll depends on this box's width, not the window's: a narrow column on
 * a wide screen needs the fade too.
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
   * Names the box for a screen reader. Below its floor width the box scrolls,
   * Chrome makes it a tab stop, and an unnamed stop announces nothing, even
   * when the SVG inside has its own `role="img"` label. Pass one whenever the
   * box can scroll.
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
 * not in it. Every chart names the models it couldn't draw in the same place,
 * so a missing model never reads as a hidden one. (The heatmap's em dash is
 * different: it marks one cell a model never ran, inside a chart the model
 * does appear in.)
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
   * Caps the note and trailer at a reading measure, for the full-width charts.
   * The ranked panels sit two-up in a grid already narrower than 62ch, so they
   * leave it off.
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
