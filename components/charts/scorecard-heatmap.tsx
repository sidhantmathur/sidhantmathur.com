import { ScrollFade, floorWidth } from "./chart-frame";
import { RAMP, inkOn, rampStep } from "./chart-tokens";
import type { ModelRow } from "@/lib/model-comparison";

// Model × eval group, cell = pass rate.
//
// A grid rather than a composite score: a model that answers grounded
// questions well and folds under prompt injection is different from one that
// is mediocre at both, and a single index can't say so.
//
// One hue, ordered steps, brighter is more. The value is printed in every
// cell, so colour is never the only way to read it, and inkOn picks whichever
// ink contrasts more with the fill.

export type ScorecardHeatmapProps = {
  rows: ModelRow[];
  groups: string[];
};

export function ScorecardHeatmap({ rows, groups }: ScorecardHeatmapProps) {
  if (!rows.length || !groups.length) return null;

  return (
    // Below the table's 520px floor the box scrolls and fades, so a phone
    // shows there are more columns instead of clipping them.
    <>
      <ScaleKey />
      <ScrollFade width={520} className="mt-3" label="Pass rate by model and eval group">
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
              {/* Wraps rather than truncates: `title` is a hover affordance,
                  so on a phone a clipped model name could not be read. The
                  title adds the vendor prefix. */}
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
 * The scale, stated: colour carries a value in this one chart, so the key says
 * which way the ramp runs. The printed values don't depend on it.
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
  // Not measured is not the bottom of the ramp. A group a model never ran is
  // the surface with an em dash on it, the same distinction the rest of
  // /measurements makes between zero and nothing.
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
