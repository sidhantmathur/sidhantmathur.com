import { ChartFrame, shortNames } from "./chart-frame";
import { BAR_PX, CONTEXT, MARK } from "./chart-tokens";
import type { RankResult } from "@/lib/model-comparison";

// A single-series ranked bar panel.
//
// HTML and CSS rather than SVG, so the labels stay real text at a real size at
// any width: an SVG that scales to fit a narrow column takes its type down
// with it. One series per panel, so the heading does the job of a legend.

export type RankedBarsProps = {
  heading: string;
  /** What the number is and which direction is good. Sits under the heading. */
  note: string;
  /** A whole `rank()`, bars and the models it had no number for. */
  ranked: RankResult;
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
  ranked: { bars, missing },
  format,
  bestLabel,
}: RankedBarsProps) {
  return (
    <ChartFrame
      heading={heading}
      note={note}
      trailer={missing.length > 0 ? `Not measured for ${shortNames(missing)}.` : undefined}
    >
      {bars.length === 0 ? (
        <p className="t-meta mt-3 text-text-faint">Not measured in any published run.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {bars.map(({ row, value, fraction, best }) => (
            <div key={row.model}>
              <div className="flex items-baseline justify-between gap-2">
                {/* Wraps rather than truncates: `title` is a hover affordance,
                    so a clipped name on a touch screen could not be read. */}
                <span className="t-meta min-w-0 break-words text-text-soft" title={row.model}>
                  {row.short}
                </span>
                {/* Every bar is direct-labelled: a handful of rows is a
                    readable number of labels, and it keeps the tooltip off the
                    critical path. */}
                <span className="t-meta shrink-0 tabular-nums text-text">
                  {format(value)}
                  {best && <span className="ml-1.5 text-accent">{bestLabel}</span>}
                </span>
              </div>
              {/* The track is the panel's maximum drawn as space, so bar
                  lengths compare across rows without a printed axis. */}
              <div
                className="mt-1 w-full bg-raised"
                style={{ height: BAR_PX }}
                role="presentation"
              >
                <div
                  className="h-full"
                  style={{
                    // Never below a hairline: a near-zero must read as
                    // "measured and tiny", not as missing.
                    width: `${Math.max(1.5, fraction * 100)}%`,
                    background: best ? MARK : CONTEXT,
                    borderRadius: "0 4px 4px 0",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartFrame>
  );
}
