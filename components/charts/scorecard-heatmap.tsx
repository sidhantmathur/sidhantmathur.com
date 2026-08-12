import { ScrollFade, floorWidth } from "./chart-frame";
import { RAMP, inkOn, rampStep } from "./chart-tokens";
import type { ModelRow } from "@/lib/model-comparison";

// Model × eval group, cell = pass rate (Sprint 8).
//
// This exists instead of a composite "intelligence score". One number would
// hide the only interesting thing in the grid: a model that answers grounded
// questions well and folds under prompt injection is a different animal from
// one that is mediocre at both, and an index cannot say so. The grid can.
//
// Magnitude, so: one hue, ordered steps, brighter is more — validated as an
// ordinal ramp against the dark surface. The value is PRINTED IN EVERY CELL, so
// colour is never the only way to read it, and the ink inside a cell is picked
// by the fill's luminance so it always clears contrast.

export type ScorecardHeatmapProps = {
  rows: ModelRow[];
  groups: string[];
};

export function ScorecardHeatmap({ rows, groups }: ScorecardHeatmapProps) {
  if (!rows.length || !groups.length) return null;

  return (
    // Gated on the table's own floor width: on a phone this grid is 358px wide
    // and 520px of table, and it clipped the last column dead flat with nothing
    // saying there was one.
    <>
      <ScaleKey />
      <ScrollFade width={520} className="mt-3">
      <table className={`t-meta w-full ${floorWidth(520)} border-separate border-spacing-[2px]`}>
        <caption className="sr-only">
          Pass rate by model and eval group. Each cell prints its own value.
        </caption>
        <thead>
          <tr>
            <th className="px-1 pb-1 text-left font-normal text-text-faint">model</th>
            {groups.map((g) => (
              <th key={g} className="px-1 pb-1 text-center font-normal text-text-faint">
                {g}
              </th>
            ))}
            <th className="px-1 pb-1 text-center font-normal text-text-faint">all</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.model}>
              {/* Wraps rather than truncates. Measured on a 390px phone, this
                  header clipped "gemini-3.5-flash-lite" by 15px — and the only
                  way to read the rest was the `title` below, which is a hover
                  affordance and hover does not exist on the device that was
                  clipping it. The row's own identity was the one thing a touch
                  reader could not recover. Two lines on a narrow column costs
                  nothing; a name is not a place to save 15px. The title stays as
                  what it always should have been, an enhancement carrying the
                  vendor prefix, rather than the only way in. */}
              <th
                scope="row"
                className="max-w-[150px] px-1 text-left font-normal break-words text-text-soft"
                title={row.model}
              >
                {row.short}
              </th>
              {groups.map((g) => {
                const cell = row.groups.find((x) => x.group === g);
                return <Cell key={g} rate={cell?.rate ?? null} passed={cell?.passed} total={cell?.total} />;
              })}
              {/* `answered`, not `cases` — the tooltip must agree with the
                  percentage printed in the cell, and that rate excludes turns
                  the model never got to answer. */}
              <Cell rate={row.passRate} passed={row.passed} total={row.answered} strong />
            </tr>
          ))}
        </tbody>
      </table>
      </ScrollFade>
    </>
  );
}

/**
 * The scale, stated. Colour carries a value in this one chart, so the reader is
 * told which direction the ramp runs — and the value is printed in every cell
 * anyway, so the key supplements the numbers rather than gating them.
 */
function ScaleKey() {
  return (
    <div className="t-meta mt-4 flex items-center gap-2 text-text-faint">
      <span>lower</span>
      <span className="flex" aria-hidden>
        {RAMP.map((step) => (
          <span key={step} className="h-2.5 w-5" style={{ background: step }} />
        ))}
      </span>
      <span>higher pass rate</span>
    </div>
  );
}

function Cell({
  rate,
  passed,
  total,
  strong,
}: {
  rate: number | null;
  passed?: number;
  total?: number;
  strong?: boolean;
}) {
  // Not measured is NOT the bottom of the ramp. A group a model never ran is
  // the surface with an em dash on it — the same distinction the rest of
  // /measurements makes between "zero" and "nothing here".
  if (rate == null) {
    return (
      <td className="border border-line px-1 py-1.5 text-center tabular-nums text-text-faint">—</td>
    );
  }
  const fill = rampStep(rate);
  return (
    <td
      className="px-1 py-1.5 text-center tabular-nums"
      style={{ background: fill, color: inkOn(fill) }}
      title={total != null ? `${passed}/${total} passed` : undefined}
    >
      <span className={strong ? "font-medium" : undefined}>{Math.round(rate * 100)}%</span>
    </td>
  );
}
