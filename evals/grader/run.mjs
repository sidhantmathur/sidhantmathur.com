// The entailment grader. Eval time only, never in the request path.
//
//   npm run eval:grade -- --dry-run          # no key, no network: rows and cost
//   npm run eval:grade -- --stub             # offline, the keyword baseline
//   npm run eval:grade                       # the calibration set, live
//   npm run eval:grade -- --from-live evals/results.json   # a live run's verified claims
//
// A live run needs AI_GATEWAY_API_KEY, in the environment or in .env.local
// (the npm script loads it if present). It is the production key, so:
//
//   --max-usd <n>     hard cap on this run's spend, default 0.50. Each call is
//                     priced at its worst case before it may start.
//   --keep-usd <n>    refuse to start if the Gateway balance, less --max-usd,
//                     would fall below this. Default 2.00, for the chat.
//
// Other options: --model <id> (default: the chat's default model, from
// lib/models.ts), --reasoning <level> (default low), --max-output-tokens <n>
// (default 600), --limit <n>, --kind <kind>, --input <file.jsonl>, --out
// <file>, --price-input/--price-output <$ per 1M> for a model the catalogue
// doesn't price.
//
// Results go to evals/grader/results.json (git-ignored). Exit codes: 0 done,
// 1 the run ended early (cap or failures), 2 it couldn't start.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_MODEL } from "../../lib/models.ts";
import { verifyAnswer } from "../../lib/verify.ts";
import { ROOT, read, readChunks } from "../lib/artifacts.mjs";
import { Budget, DEFAULT_MAX_USD, priceFor } from "./budget.mjs";
import { gradeRows, projectCost } from "./grade.mjs";
import { gatewayBalance, gatewayJudge, heuristicJudge } from "./judge.mjs";
import { LABELS, PROMPT_VERSION } from "./prompt.mjs";
import { CALIBRATION, liveRows, loadCalibration } from "./rows.mjs";
import { formatRate, scoreRun } from "./score.mjs";

const args = process.argv.slice(2);
const has = (name) => args.includes(`--${name}`);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const number = (name, fallback) => {
  const raw = flag(name, null);
  if (raw == null) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) fail(`--${name} must be a number, got "${raw}"`);
  return value;
};

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(2);
}

const dollars = (usd) => `$${usd.toFixed(4)}`;

const MODEL = flag("model", DEFAULT_MODEL);
const MAX_USD = number("max-usd", DEFAULT_MAX_USD);
const KEEP_USD = number("keep-usd", 2);
const MAX_OUTPUT_TOKENS = number("max-output-tokens", 600);
const REASONING = flag("reasoning", "low");
const LIMIT = number("limit", Infinity);
const KIND = flag("kind", null);
const OUT = flag("out", "evals/grader/results.json");
const FROM_LIVE = flag("from-live", null);
const DRY_RUN = has("dry-run");
const STUB = has("stub");

const price = STUB
  ? { input: 0, output: 0, factor: 1, confidence: "offline" }
  : priceFor(MODEL, { input: number("price-input", null), output: number("price-output", null) });
if (!price) {
  fail(
    `${MODEL} isn't priced in lib/models.ts, so the cap can't be enforced. ` +
      "Pass --price-input and --price-output (dollars per 1M tokens); they are budgeted at 4x.",
  );
}

// --- Rows -------------------------------------------------------------------

let rows;
if (FROM_LIVE) {
  const lookup = Object.fromEntries(readChunks().map((c) => [c.id, c]));
  rows = liveRows(JSON.parse(read(FROM_LIVE)), lookup, verifyAnswer);
} else {
  rows = loadCalibration(flag("input", CALIBRATION));
}
if (KIND) rows = rows.filter((r) => r.kind === KIND);
rows = rows.slice(0, LIMIT);
if (!rows.length) fail("no rows to grade.");

const mix = LABELS.map((l) => `${rows.filter((r) => r.label === l).length} ${l}`).join(", ");
const projected = projectCost(rows, { price, maxOutputTokens: MAX_OUTPUT_TOKENS });

console.log(`\n  Entailment grader · prompt ${PROMPT_VERSION}`);
console.log(`  ${rows.length} claim(s) from ${FROM_LIVE ?? flag("input", CALIBRATION)}${FROM_LIVE ? "" : ` (${mix})`}`);
if (STUB) {
  console.log("  Judge: the keyword stub, offline. A floor for a model to beat, not a judge.");
} else {
  console.log(
    `  Judge: ${MODEL}, reasoning ${REASONING}, at $${price.input}/$${price.output} per 1M ` +
      `(${price.confidence}${price.factor !== 1 ? `, budgeted at ${price.factor}x` : ""})`,
  );
  console.log(
    `  Cost: about ${dollars(projected.expectedUsd)} expected, ${dollars(projected.worstUsd)} worst case ` +
      `(~${projected.inputTokens.toLocaleString()} input tokens, ≤${MAX_OUTPUT_TOKENS} output a call). Cap ${dollars(MAX_USD)}.`,
  );
  if (projected.worstUsd > MAX_USD) {
    console.log("  The worst case is over the cap: the run stops at the first call that might cross it.");
  }
}

if (DRY_RUN) {
  console.log("\n  Dry run: nothing was sent. To run it:");
  console.log(`    AI_GATEWAY_API_KEY=… npm run eval:grade -- --model ${MODEL} --max-usd ${MAX_USD}\n`);
  process.exit(0);
}

// --- Run ------------------------------------------------------------------

let before = null;
if (!STUB) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    fail("AI_GATEWAY_API_KEY isn't set (environment or .env.local). Use --dry-run or --stub to run without it.");
  }
  before = await gatewayBalance();
  if (before == null) {
    console.log("  Couldn't read the Gateway balance; the cap still applies.");
  } else {
    console.log(`  Gateway balance: $${before.balance.toFixed(2)}.`);
    if (before.balance - MAX_USD < KEEP_USD) {
      fail(
        `Spending up to ${dollars(MAX_USD)} would leave less than $${KEEP_USD.toFixed(2)} for the production chat. ` +
          "Lower --max-usd, or pass --keep-usd 0 if that's intended.",
      );
    }
  }
}

const judge = STUB
  ? heuristicJudge()
  : gatewayJudge({ model: MODEL, maxOutputTokens: MAX_OUTPUT_TOKENS, reasoning: REASONING });
const startedAt = new Date().toISOString();
console.log("");

const run = await gradeRows(rows, {
  judge,
  price,
  budget: new Budget(STUB ? Infinity : MAX_USD),
  maxOutputTokens: MAX_OUTPUT_TOKENS,
  onResult: (result) => {
    const mark = result.truth == null ? "·" : result.predicted === result.truth ? "✓" : "✗";
    const verdict = result.truth == null ? result.predicted : `${result.truth} → ${result.predicted}`;
    console.log(`  ${mark} ${result.id}: ${verdict ?? result.error}${result.reason ? ` — ${result.reason}` : ""}`);
  },
});

const after = STUB ? null : await gatewayBalance();
const score = scoreRun(run.results);

console.log(`\n${"═".repeat(60)}`);
if (score.n) {
  const o = score.overstated;
  const p = score.problem;
  console.log(`  Overstated: precision ${formatRate(o.precision, o.tp, o.predicted)}, recall ${formatRate(o.recall, o.tp, o.support)}`);
  console.log(`  Overstated or unsupported: precision ${formatRate(p.precision, p.tp, p.predicted)}, recall ${formatRate(p.recall, p.tp, p.support)}`);
  console.log(`  Accuracy over all four labels: ${formatRate(score.accuracy, Math.round((score.accuracy ?? 0) * score.n), score.n)}`);
  for (const [kind, k] of Object.entries(score.byKind)) console.log(`    ${kind}: ${k.correct}/${k.n}`);
  if (score.parsed < score.n) console.log(`  ${score.n - score.parsed} repl(ies) couldn't be read.`);
} else {
  const counts = LABELS.map((l) => `${run.results.filter((r) => r.predicted === l).length} ${l}`).join(", ");
  console.log(`  ${run.results.length} verified claim(s) graded: ${counts}.`);
}
if (!STUB) {
  console.log(`  Spent ${dollars(run.spentUsd)} at list price (budgeted rate), cap ${dollars(MAX_USD)}.`);
  if (before && after?.used != null && before.used != null) {
    console.log(`  The Gateway's own count moved $${(after.used - before.used).toFixed(4)} (an upper bound: the key is shared).`);
  }
}
if (run.stoppedAt) console.log(`  Stopped at ${run.stoppedAt}: the next call could have crossed the cap.`);
if (run.abortedBy) console.log(`  Stopped after repeated failures: ${run.abortedBy}`);

const target = join(ROOT, OUT);
writeFileSync(
  target,
  JSON.stringify(
    {
      promptVersion: PROMPT_VERSION,
      judge: STUB ? "stub" : MODEL,
      reasoning: STUB ? null : REASONING,
      input: FROM_LIVE ?? flag("input", CALIBRATION),
      startedAt,
      finishedAt: new Date().toISOString(),
      maxUsd: STUB ? null : MAX_USD,
      spentUsd: run.spentUsd,
      billedDeltaUsd: before?.used != null && after?.used != null ? after.used - before.used : null,
      stoppedAt: run.stoppedAt,
      abortedBy: run.abortedBy,
      score,
      results: run.results,
    },
    null,
    2,
  ),
);
console.log(`  Wrote ${OUT}\n`);
process.exit(run.stoppedAt || run.abortedBy ? 1 : 0);
