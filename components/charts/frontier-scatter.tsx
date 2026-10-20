import { ChartFrame, ScrollFade, floorWidth, shortNames } from "./chart-frame";
import { CONTEXT, GRID, MARK, SURFACE } from "./chart-tokens";
import { formatPercent } from "@/lib/measurements";
import { placeLabels, type FrontierResult } from "@/lib/model-comparison";

// Quality against cost, or quality against latency: one dot per model, better
// is up, cheaper or faster is left. Dots on the Pareto frontier (nothing
// measured beats them on both axes) wear the accent; the rest are context
// grey. Identity comes from the label beside each dot, so there is no
// categorical palette.
//
// Two charts rather than one: cost and latency on one plot against a shared
// quality axis would be a dual-axis chart, and the alignment between the two
// scales would be arbitrary and imply a correlation.
//
// SVG, unlike the bar panels, because dots need two-dimensional positioning.
// Type scales with an SVG, so the figure sits in a scrollable box with a floor
// width rather than shrinking its labels.

const W = 560;
const H = 300;
const PAD = { top: 16, right: 28, bottom: 44, left: 72 };
const PLOT = {
  x0: PAD.left,
  x1: W - PAD.right,
  y0: PAD.top,
  y1: H - PAD.bottom,
};

export type FrontierScatterProps = {
  heading: string;
  note: string;
  /** A whole `frontier()`, points and the models missing an axis. */
  plot: FrontierResult;
  xLabel: string;
  /** Log for money (it spans an order of magnitude); linear for milliseconds. */
  xScale: "log" | "linear";
  formatX: (value: number) => string;
};

// The y axis is fixed rather than a prop: the two charts are two views of one
// trade, comparable only because the vertical is the same measure (pass rate)
// in both.
const Y_LABEL = "pass rate (answered)";
const formatY = formatPercent;
/** Axis ticks want round numbers; the dots and tooltip carry the precision. */
const formatYTick = (value: number) => `${Math.round(value * 100)}%`;

/** Ticks that land on readable numbers rather than on the data's extremes. */
function linearTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step / 2; v += step) if (v >= min - step / 2) ticks.push(v);
  return ticks;
}

function logTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  const lo = Math.floor(Math.log10(min));
  const hi = Math.ceil(Math.log10(max));
  for (let e = lo; e <= hi; e += 1) {
    for (const m of [1, 3]) {
      const v = m * 10 ** e;
      if (v >= min * 0.85 && v <= max * 1.2) ticks.push(v);
    }
  }
  return ticks.length >= 2 ? ticks : [min, max];
}

export function FrontierScatter({
  heading,
  note,
  plot: { points, unplotted },
  xLabel,
  xScale,
  formatX,
}: FrontierScatterProps) {
  if (!points.length) {
    return (
      <ChartFrame heading={heading}>
        <p className="t-meta mt-2 text-text-faint">
          Nothing published carries both axes, so there is no chart to draw.
        </p>
      </ChartFrame>
    );
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  // Domains are padded outward so no dot sits on an axis. The y domain is not
  // pinned to zero: pass rates cluster near the top and a 0–100 axis would
  // flatten every difference. The note says the axis is zoomed.
  const xPad = xScale === "log" ? 1.25 : (Math.max(...xs) - Math.min(...xs)) * 0.15 || 1;
  const xMin = xScale === "log" ? Math.min(...xs) / xPad : Math.min(...xs) - xPad;
  const xMax = xScale === "log" ? Math.max(...xs) * xPad : Math.max(...xs) + xPad;
  const yPad = (Math.max(...ys) - Math.min(...ys)) * 0.25 || 0.05;
  const yMin = Math.max(0, Math.min(...ys) - yPad);
  const yMax = Math.min(1, Math.max(...ys) + yPad);

  const sx = (v: number) => {
    const t =
      xScale === "log"
        ? (Math.log10(v) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin) || 1)
        : (v - xMin) / (xMax - xMin || 1);
    return PLOT.x0 + t * (PLOT.x1 - PLOT.x0);
  };
  const sy = (v: number) => PLOT.y1 - ((v - yMin) / (yMax - yMin || 1)) * (PLOT.y1 - PLOT.y0);

  // Ticks are clamped to the domain: `linearTicks` rounds outward, which can
  // put the first tick below the plot floor, as a stray label under the x-axis
  // title.
  const inDomain = (lo: number, hi: number) => (v: number) => v >= lo && v <= hi;
  const xTicks = (xScale === "log" ? logTicks(xMin, xMax) : linearTicks(xMin, xMax)).filter(
    inDomain(xMin, xMax),
  );
  const yTicks = linearTicks(yMin, yMax, 3).filter(inDomain(yMin, yMax));
  // Labels go wherever they clear the other dots and labels — see placeLabels.
  // The right edge of the drawing, not of the plot, is the limit: a label may
  // run into the right padding, as it always could, but never off the SVG.
  const spots = placeLabels(
    points.map((p) => ({ x: sx(p.x), y: sy(p.y), text: p.row.short })),
    { x0: PLOT.x0, x1: W },
  );

  return (
    <ChartFrame
      heading={heading}
      note={`${note} The vertical axis is zoomed to the measured range, not to zero.`}
      measure
      trailer={
        <>
          <span className="text-accent">Highlighted</span> models sit on the frontier — nothing
          measured here is both better and {xScale === "log" ? "cheaper" : "faster"}.
          {unplotted.length > 0 &&
            ` ${shortNames(unplotted)} could not be plotted: one of the two axes was not measured.`}
        </>
      }
    >
      <ScrollFade width={560} className="mt-3" label={heading}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          // The floor width is the viewBox width, so 10px labels render at
          // 10px at the floor instead of scaling down; narrower boxes scroll.
          className={`h-auto w-full ${floorWidth(560)}`}
          role="img"
          aria-label={`${heading}. ${points
            .map((p) => `${p.row.short}: ${formatX(p.x)}, ${formatY(p.y)}`)
            .join("; ")}`}
        >
          {/* Gridlines */}
          {yTicks.map((t) => (
            <line
              key={`y${t}`}
              x1={PLOT.x0}
              x2={PLOT.x1}
              y1={sy(t)}
              y2={sy(t)}
              stroke={GRID}
              strokeWidth={1}
            />
          ))}
          {xTicks.map((t) => (
            <text
              key={`xt${t}`}
              x={sx(t)}
              y={PLOT.y1 + 16}
              textAnchor="middle"
              className="fill-[var(--text-faint)] text-[10px] tabular-nums"
            >
              {formatX(t)}
            </text>
          ))}
          {yTicks.map((t) => (
            <text
              key={`yt${t}`}
              x={PLOT.x0 - 8}
              y={sy(t) + 3}
              textAnchor="end"
              className="fill-[var(--text-faint)] text-[10px] tabular-nums"
            >
              {formatYTick(t)}
            </text>
          ))}

          {/* Axis titles — text tokens, never a data colour. */}
          <text
            x={(PLOT.x0 + PLOT.x1) / 2}
            y={H - 8}
            textAnchor="middle"
            className="fill-[var(--text-faint)] text-[10px]"
          >
            {xLabel} →
          </text>
          <text
            x={PLOT.x0 - 56}
            y={(PLOT.y0 + PLOT.y1) / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${PLOT.x0 - 56} ${(PLOT.y0 + PLOT.y1) / 2})`}
            className="fill-[var(--text-faint)] text-[10px]"
          >
            {Y_LABEL} →
          </text>

          {points.map((p, i) => {
            const cx = sx(p.x);
            const cy = sy(p.y);
            const fill = p.onFrontier ? MARK : CONTEXT;
            const spot = spots[i];
            return (
              <g key={p.row.model}>
                {/* Hit target: the dot is 9px across, so a transparent 24px
                    circle carries the tooltip. */}
                <circle cx={cx} cy={cy} r={12} fill="transparent">
                  <title>
                    {`${p.row.model} — ${formatY(p.y)} on ${p.row.cases} cases, ${formatX(p.x)}` +
                      (p.onFrontier ? " · on the frontier" : "")}
                  </title>
                </circle>
                {/* A 2px ring in the surface colour keeps overlapping dots
                    legible. */}
                <circle cx={cx} cy={cy} r={4.5} fill={fill} stroke={SURFACE} strokeWidth={2} />
                <text
                  x={spot.x}
                  y={spot.y}
                  textAnchor={spot.anchor}
                  className={
                    p.onFrontier
                      ? "fill-[var(--text)] text-[10px]"
                      : "fill-[var(--text-soft)] text-[10px]"
                  }
                >
                  {p.row.short}
                </text>
              </g>
            );
          })}
        </svg>
      </ScrollFade>
    </ChartFrame>
  );
}
