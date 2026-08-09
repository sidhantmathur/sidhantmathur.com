import { CONTEXT, GRID, MARK, SURFACE } from "./chart-tokens";
import type { FrontierPoint } from "@/lib/model-comparison";
import type { ModelRow } from "@/lib/model-comparison";

// Quality against cost, and quality against latency (Sprint 8).
//
// The Artificial Analysis move, and the single most useful frame for "which of
// these should this site actually run": one dot per model, better is up, cheaper
// and faster is left. Dots on the Pareto frontier — nothing measured is both
// cheaper AND better — wear the accent; everything else is context grey. That is
// emphasis, computed rather than chosen, and it is why this chart needs no
// categorical palette: identity comes from the label beside each dot.
//
// TWO CHARTS RATHER THAN ONE. Cost and latency are different scales, and putting
// both on one plot against a shared quality axis would be a dual-axis chart —
// the one construction this method rules out outright, because the alignment
// between the two scales is arbitrary and invents a correlation.
//
// SVG here, unlike the bar panels: dots need two-dimensional positioning, which
// CSS boxes cannot do honestly. The cost is that type scales with the chart, so
// the figure sits in its own horizontally scrollable box with a floor width
// rather than shrinking its axis labels into illegibility.

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
  points: FrontierPoint[];
  unplotted: ModelRow[];
  xLabel: string;
  yLabel: string;
  /** Log for money (it spans an order of magnitude); linear for milliseconds. */
  xScale: "log" | "linear";
  formatX: (value: number) => string;
  formatY: (value: number) => string;
  /** Axis ticks want round numbers; the dots and tooltip carry the precision. */
  formatYTick?: (value: number) => string;
};

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
  points,
  unplotted,
  xLabel,
  yLabel,
  xScale,
  formatX,
  formatY,
  formatYTick = formatY,
}: FrontierScatterProps) {
  if (!points.length) {
    return (
      <figure className="m-0">
        <figcaption className="t-meta font-medium text-text">{heading}</figcaption>
        <p className="t-meta mt-2 text-text-faint">
          Nothing published carries both axes, so there is no chart to draw.
        </p>
      </figure>
    );
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  // Domains are padded outward so no dot sits on an axis, and the y domain is
  // NOT pinned to zero: these pass rates cluster near the top, and a 0–100 axis
  // would flatten every difference the chart exists to show. The ticks are
  // printed, and the caption says the axis is zoomed — the honesty is in the
  // labelling rather than in a rule that would make the chart useless.
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

  // Ticks are clamped to the domain. `linearTicks` rounds outward to land on
  // readable numbers, which can put the first tick BELOW the plot floor — it
  // then renders under the x-axis title as a stray label pointing at nothing.
  const inDomain = (lo: number, hi: number) => (v: number) => v >= lo && v <= hi;
  const xTicks = (xScale === "log" ? logTicks(xMin, xMax) : linearTicks(xMin, xMax)).filter(
    inDomain(xMin, xMax),
  );
  const yTicks = linearTicks(yMin, yMax, 3).filter(inDomain(yMin, yMax));

  return (
    // A query container, so the fade below can ask how wide the chart actually
    // is instead of how wide the window is.
    <figure className="@container m-0">
      <figcaption>
        <div className="t-meta font-medium text-text">{heading}</div>
        <div className="t-meta mt-0.5 max-w-[62ch] text-text-faint">
          {note} The vertical axis is zoomed to the measured range, not to zero.
        </div>
      </figcaption>

      {/* The same right-edge fade the actions strip uses, for the same reason:
          there is no scrollbar on a phone, and a plot whose rightmost model
          label sat exactly at the edge looked like a plot that ended there —
          the label clipped mid-word and nothing on screen saying so.

          A container query rather than a breakpoint, because the fade is a lie
          when there is nothing to scroll and the thing that decides that is
          this box's width, not the window's. Below 560px — the SVG's floor
          width, and now its viewBox width — the box scrolls and the fade earns
          its place; at or above it the drawing fits and the fade would only be
          dimming real data. A media query would get this right on a phone and
          wrong in any narrow column on a wide screen. */}
      <div className="mt-3 overflow-x-auto [mask-image:linear-gradient(to_right,black_92%,transparent)] @[560px]:[mask-image:none]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          // The floor width IS the viewBox width. It was 480 against a 560
          // viewBox, which scales the whole drawing to 0.857 — so the 10px
          // ticks and model labels rendered at 8.6px on the one device that
          // hits the floor. A type size that only means what it says at one
          // width is not a type size; pinning the two together makes 10px
          // 10px, and the box scrolls the extra 80px like it was already
          // scrolling the rest.
          className="h-auto w-full min-w-[560px]"
          role="img"
          aria-label={`${heading}. ${points
            .map((p) => `${p.row.short}: ${formatX(p.x)}, ${formatY(p.y)}`)
            .join("; ")}`}
        >
          {/* Grid — hairline, solid, one step off the surface, recessive. */}
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
            {yLabel} →
          </text>

          {points.map((p) => {
            const cx = sx(p.x);
            const cy = sy(p.y);
            const fill = p.onFrontier ? MARK : CONTEXT;
            // Labels flip to the left near the right edge so a name never runs
            // off the plot. A label that doesn't fit is not clipped.
            const flip = cx > PLOT.x1 - 110;
            return (
              <g key={p.row.model}>
                {/* Hit target. The dot is 9px across; a pointer should not have
                    to land dead-centre on it, so the interactive circle is the
                    24px minimum and carries the tooltip. */}
                <circle cx={cx} cy={cy} r={12} fill="transparent">
                  <title>
                    {`${p.row.model} — ${formatY(p.y)} on ${p.row.cases} cases, ${formatX(p.x)}` +
                      (p.onFrontier ? " · on the frontier" : "")}
                  </title>
                </circle>
                {/* 2px ring in the surface colour, so dots stay legible where
                    they overlap. Not a border — a spacer. */}
                <circle cx={cx} cy={cy} r={4.5} fill={fill} stroke={SURFACE} strokeWidth={2} />
                <text
                  x={flip ? cx - 9 : cx + 9}
                  y={cy + 3.5}
                  textAnchor={flip ? "end" : "start"}
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
      </div>

      <p className="t-meta mt-2 max-w-[62ch] text-text-faint">
        <span className="text-accent">Highlighted</span> models sit on the frontier — nothing
        measured here is both better and {xScale === "log" ? "cheaper" : "faster"}.
        {unplotted.length > 0 &&
          ` ${unplotted.map((m) => m.short).join(", ")} could not be plotted: one of the two axes was not measured.`}
      </p>
    </figure>
  );
}
