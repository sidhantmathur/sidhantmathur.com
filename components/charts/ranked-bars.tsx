import { BAR_PX, CONTEXT, MARK } from "./chart-tokens";
import type { Ranked } from "@/lib/model-comparison";
import type { ModelRow } from "@/lib/model-comparison";

// A single-series ranked bar panel (Sprint 8).
//
// HTML and CSS rather than SVG, on purpose. These panels have to reflow from an
// 80ch document down into the shell's ~380px context panel, and an SVG that
// scales to fit takes its type down with it — an 11px axis label becomes 6px in
// the panel. Divs keep the labels as real text at a real size at every width,
// and a bar is a box, which is the one mark HTML draws natively.
//
// One series per panel, so there is no legend: the heading names what is
// plotted, which is the whole job a one-swatch legend box would do.

export type RankedBarsProps = {
  heading: string;
  /** What the number is and which direction is good. Sits under the heading. */
  note: string;
  bars: Ranked[];
  missing: ModelRow[];
  format: (value: number) => string;
  /**
   * Names the winner in the panel's own terms — "fastest", "cheapest". Omitted
   * on a metric with no better direction, where nothing is emphasised at all.
   */
  bestLabel?: string;
};

export function RankedBars({
  heading,
  note,
  bars,
  missing,
  format,
  bestLabel,
}: RankedBarsProps) {
  return (
    <figure className="m-0">
      <figcaption>
        <div className="text-[12px] text-text">{heading}</div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-text-faint">{note}</div>
      </figcaption>

      {bars.length === 0 ? (
        <p className="mt-3 text-[11px] text-text-faint">Not measured in any published run.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {bars.map(({ row, value, fraction, best }) => (
            <div key={row.model}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[11px] text-text-soft" title={row.model}>
                  {row.short}
                </span>
                {/* The value is direct-labelled on every bar here rather than
                    selectively: five rows is a readable number of labels, and
                    it removes the tooltip from the critical path entirely. */}
                <span className="shrink-0 text-[11px] tabular-nums text-text">
                  {format(value)}
                  {best && <span className="ml-1.5 text-accent">{bestLabel}</span>}
                </span>
              </div>
              {/* The track is not a second data mark — it is the panel's
                  maximum drawn as space, so bar lengths are comparable across
                  rows without a printed axis. */}
              <div
                className="mt-1 w-full bg-raised"
                style={{ height: BAR_PX }}
                role="presentation"
              >
                <div
                  className="h-full"
                  style={{
                    // Never below a hairline: a genuine near-zero must still be
                    // visible as "measured and tiny", not read as missing.
                    width: `${Math.max(1.5, fraction * 100)}%`,
                    background: best ? MARK : CONTEXT,
                    // 4px rounded data-end, square at the baseline.
                    borderRadius: "0 4px 4px 0",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <p className="mt-2 text-[11px] text-text-faint">
          Not measured for {missing.map((m) => m.short).join(", ")}.
        </p>
      )}
    </figure>
  );
}
