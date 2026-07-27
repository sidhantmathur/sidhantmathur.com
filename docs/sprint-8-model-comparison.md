# Sprint 8 spec — the model bake-off

One page, written 2026-07-27. Intent, design and acceptance only.

Covers a gap Sprint 6 left open: **the eval harness measures five models and
publishes one.**

---

## Intent

Sprint 6 shipped `/measurements`, and it is honest about everything except its
own shape. It publishes a *snapshot* — the static suite, plus a live run **per
model, latest wins**. Two consequences nobody wrote down at the time:

1. **A second run on the same model destroys the first.** `evals/results.json`
   is overwritten by every `npm run eval:live`, and the publisher then replaces
   that model's entry in the snapshot. There is no record that an earlier run
   happened, so there is no way to see a regression, and no way to tell a
   measurement taken twice from a measurement taken once.
2. **The interesting half of every run is thrown away at publish time.** The
   runner already records, per turn, the full Sprint 1 telemetry record: time to
   first token, wall-clock duration, output tokens per second, input tokens,
   cached input tokens, output tokens, steps, tools called, finish reason. The
   publisher's summariser keeps verdicts and drops all of it. The site can say a
   model passed 6 of 6; it cannot say what that cost or how long it took.

So the site runs an eval harness against five allowlisted models and publishes a
pass count for one of them. This sprint publishes the comparison — the artifact
the harness was always producing and then discarding.

The audience is specific: someone who wants evidence that the person who built
this can *evaluate* an LLM system, not just call one. That evidence is a
frontier chart, not a paragraph.

## What ships

**A run archive.** Every published live run is kept, keyed by model *and* run
time. The headline per model is the most recent run; the previous ones stay on
the record and are listed with their dates. Nothing overwrites anything.

**A performance record per run.** The publisher stops discarding telemetry. Per
run it publishes, per turn and in aggregate: TTFT, duration, output tokens/sec,
input tokens, cached input tokens, output tokens, steps, finish reason — and
cost, computed from `lib/pricing.ts` at list price.

**`/measurements/models`** — a comparison page with the charts below, built at
build time from the committed snapshot, statically rendered like every other
route. And a link to it from `/measurements`.

This is a **run-once artifact**, not a live dashboard. It is measured
deliberately, committed, and dated. It goes stale, and the page says so with the
date rather than pretending otherwise.

## Constraints

- **Static-first.** Charts are inline SVG computed at build time from the
  snapshot. No chart library, no new dependency, no client fetch. Hover is
  native SVG `<title>`, so the interaction layer costs zero JavaScript.
- **Money is published here, and it is labelled.** Sprint 2 decided nothing on
  `/measurements` would be denominated in dollars. This page reverses that
  narrowly and deliberately: cost-per-task is the whole point of a frontier
  chart. It is published as a **list-price estimate**, with the date the prices
  were checked, and the one row `lib/pricing.ts` marks unconfirmed is marked
  unconfirmed on the page too.
- **No fact about Sidhant appears on this page.** It is entirely measurements
  about models. Every drafted string still goes in `docs/copy-ledger.md`.
- **The model's prose still does not travel.** Same rule as Sprint 6: verdicts,
  counts and numbers are measurements; answers are unreviewed model output.
- **Empty by default.** No snapshot, no page content — the same rule the rest of
  `/measurements` lives by. There is no sample data anywhere in this sprint.
- **Do not touch the chat route, the shell, or the system prompt.** Sprint 7 is
  live in those files. This sprint owns `evals/`, `scripts/`, `lib/` additions,
  and `app/measurements/`.

## The visualization design

### Palette — decided, and validated, before any chart was drawn

The site has **one accent** (`--accent` `#E4522B`) and a monochrome ink scale.
A five-series categorical palette would break that, and would also fail the
all-pairs colour-blindness gate that scatter plots are held to — five hues
cannot be pairwise-distinguished under simulated protanopia.

So there is **no categorical palette here**. Identity travels by direct label
and by the table; colour does one job only — emphasis and magnitude:

| Role | Token | Contrast vs `--bg` |
| --- | --- | --- |
| The measured value / the emphasised model | `--accent` `#E4522B` | 5.22:1 |
| Context — the models that aren't the point | `--text-faint` `#6B655E` | 3.44:1 |
| Grid, axes | `--line-strong` `#332E29` | recessive, hairline, solid |
| Heatmap magnitude ramp (5 ordinal steps, accent hue) | `#782e1a` → `#9a3a1f` → `#bf4625` → `#e4522b` → `#fba57f` | 2.08 → 10.16 |

Both the mark colours and the ramp were checked with the data-viz validator, not
eyeballed: the marks clear the 3:1 floor, and the ramp passes monotone
lightness, adjacent ΔL ≥ 0.06, light-end contrast ≥ 2:1, and single-hue.

Mark specs follow the house data-viz rules: bars ≤ 24px with a 4px rounded
data-end and a square baseline, ≥ 8px dots with a 2px surface ring, hairline
recessive grid, values as text tokens and never in the series colour.

### The charts, in page order

**1. A KPI row, then one hero figure.** Models measured · cases per model ·
turns graded · total list-price cost of the whole bake-off. The hero is the turn
count — the sample everything else is computed from, stated before any chart
that rests on it.

**2. The frontier — quality vs cost per task.** *The chart.* x = median cost per
graded turn, log scale, dollars. y = pass rate, %. One dot per model, ≥ 8px,
direct-labelled. Dots on the Pareto frontier (nothing is both cheaper and
better) wear the accent; the rest wear `--text-faint`. Up and to the left wins.
This is the Artificial Analysis move and it is the single most useful frame for
"which of these should the site actually run".

**3. The second frontier — quality vs latency.** Same construction, x = median
time to first token in ms. Two charts rather than one dual-axis chart, because
a dual-axis chart is the mistake this method exists to prevent.

**4. Ranked bars — six single-series panels, small multiples.** Each sorted
best-first, one hue, value direct-laballed at the tip, no legend (one series):
median TTFT · output tokens/sec · median cost per task · input tokens per task ·
output tokens per task · prompt-cache hit rate. Deliberately **not** a stacked
token bar: splitting input and output into two single-series panels keeps every
chart on one hue and reads better at this site's density.

**5. The scorecard heatmap.** Model × eval group (grounded · refusal ·
injection · roleFit), cell = pass rate on the accent ramp, the number printed in
the cell. This is where a composite "intelligence" score would hide the useful
detail: a model that aces grounded questions and fails injection is a different
animal from one that is mediocre at both, and one number cannot say so.

**6. The table.** Every published figure for every model, `tabular-nums`,
including the ones no chart shows. It is the accessibility relief channel for
every chart above, and it is the thing someone will actually copy.

**7. The run archive.** Every run ever published, per model, with its date —
the fix for the overwriting, made visible rather than merely implemented.

**8. What this does not measure.** Not a footnote — a section, in the house
style. At minimum: one sample per case, so a median over ~22 turns and no p95
worth printing; runs taken on different days over a home connection, so latency
carries network and time-of-day; scoring is deterministic string matching, a
regression net rather than a quality judgment, and a wrong answer containing the
right number still passes; prices are list prices on the date checked, with the
unconfirmed row named; and the corpus is 22 cases about one person's résumé,
which is a real workload but a narrow one.

## Acceptance

1. Publishing a second run on a model that already has one **keeps both**, and
   the archive section shows both with their dates.
2. The published snapshot carries per-turn and aggregate performance for every
   run: TTFT, duration, tokens/sec, input, cached input, output, steps, cost.
3. `/measurements/models` renders all eight sections above from the committed
   snapshot, statically, with no client-side data fetch and no new dependency.
4. With the snapshot removed, the page builds and reaches its empty state.
5. All five allowlisted models have a published run over all four groups.
6. Every chart's numbers also appear in the table.
7. Every drafted string is in `docs/copy-ledger.md`; no claim about Sidhant.
8. New static assertions cover the archive-keeps-both behaviour, the cost
   arithmetic, and the empty state. `npm run build` and `npm run eval` pass.

## Out of scope

- Re-running the comparison on a schedule, or in CI. It costs tokens and needs a
  key; it stays a deliberate local step, exactly like Sprint 6's live layer.
- Repeated sampling per case for variance bars. Worth doing; not worth the rate
  limit today. The page says the sample is one.
- A composite intelligence index. The heatmap is the honest version.
- Changing which model the site defaults to. This produces the evidence; the
  decision is Sidhant's.
