// The fit-check stability harness: sends each posting × model × reasoning
// level × repeat through the real /api/chat route, exactly as the paste panel
// does, and appends one JSON record per turn. scripts/report-fit-stability.mjs
// turns the records into docs/fit-check-at-scale.md tables.
//
// It costs real money once the server has a key, against the key production
// runs on. So:
//
//   - A hard cap (--max-usd, default 1.00) at list price. Before every request
//     the turn's ceiling (the most one posting turn can cost under the route's
//     limits) is reserved; it settles to the measured cost when the turn ends.
//     The list-price total cannot pass the cap. Earlier invocations against the
//     same --out file count against it too, so a restart doesn't get a fresh
//     dollar.
//   - The Gateway's own meter (GET /v1/credits) before, every --credits-every
//     turns, and after. A billed difference over the cap stops the run, which
//     covers a provider billing above list. The key is shared with production,
//     so that difference is an upper bound. The runner reads the key from its
//     own environment only to make this call; it never sends it to the server.
//   - It refuses to start when the balance less --max-usd would fall under
//     --reserve-usd (default 2.00), so a run can't eat production's month.
//   - It refuses a non-local --base unless --allow-remote, and refuses the
//     production site outright.
//
// Usage (see docs/fit-check-at-scale.md for the recommended first run):
//   node --env-file=.env.local scripts/run-fit-stability.mjs --base http://localhost:3102 --ip fit-1 --per-stratum 5
//   node scripts/run-fit-stability.mjs --dry-run                      # plan and projected cost, no requests
//   node scripts/run-fit-stability.mjs --base http://localhost:3102 --ip mock --no-credits   # against the mock
//
// Flags:
//   --base <url>             server (default http://localhost:3000)
//   --ip <prefix>            rate-limit bucket prefix, one bucket per turn (as evals/run-live.mjs)
//   --postings <file>        corpus (default evals/postings/corpus.jsonl[.gz]); evals/postings/mine.jsonl works
//   --ids a,b  --family f,g  --control none,mismatch,near-miss
//   --per-stratum <n> | --sample <n>  --seed <s>  --limit <n>
//   --models a,b             default: the site's default model
//   --reasoning <levels>     default "catalogue": what lib/models.ts sets for posting turns
//   --reasoning-header <h>   send other levels in this header (the route ignores it today)
//   --repeats <n>            default 3
//   --max-usd <x>            default 1.00
//   --reserve-usd <x>        default 2.00
//   --credits-every <n>      default 25
//   --no-credits             skip the credits endpoint (mock and offline runs)
//   --out <file>             default evals/postings/runs/fit-stability.jsonl (git-ignored)
//   --concurrency <n>        default 1, at most 4
//   --delay <ms>             between requests, default 500
//   --timeout <ms>           per turn, default 120000
//   --dry-run  --allow-remote

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_MODEL, MODELS } from "../lib/models.ts";
import { MAX_POSTING_TEXT } from "../lib/job-posting.ts";
import { formatUsd } from "../lib/pricing.ts";
import { readChunks, readRepoChunks } from "../evals/lib/artifacts.mjs";
import {
  SpendGuard,
  assertSendable,
  ceilingTurnUsd,
  chargeFor,
  finishedKeys,
  jdRequestBody,
  planCells,
  projectTurnUsd,
  readCorpus,
  readCredits,
  readResults,
  runTurn,
  selectPostings,
  spentSoFar,
  stratumOf,
  summarizeTurn,
} from "../evals/lib/fit-stability.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- args ------------------------------------------------------------------------

const args = process.argv.slice(2);
const has = (name) => args.includes(`--${name}`);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const list = (name) => flag(name, null)?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;

const BASE = flag("base", "http://localhost:3000").replace(/\/$/, "");
const IP = flag("ip", null);
const POSTINGS = resolve(ROOT, flag("postings", "evals/postings/corpus.jsonl"));
const MODELS_ARG = list("models") ?? [DEFAULT_MODEL];
const REASONINGS = list("reasoning") ?? ["catalogue"];
const REASONING_HEADER = flag("reasoning-header", null);
const REPEATS = Number(flag("repeats", "3"));
const MAX_USD = Number(flag("max-usd", "1.00"));
const RESERVE_USD = Number(flag("reserve-usd", "2.00"));
const CREDITS_EVERY = Number(flag("credits-every", "25"));
const NO_CREDITS = has("no-credits");
const OUT = resolve(ROOT, flag("out", "evals/postings/runs/fit-stability.jsonl"));
const CONCURRENCY = Math.max(1, Math.min(4, Number(flag("concurrency", "1"))));
const DELAY_MS = Number(flag("delay", "500"));
const TIMEOUT_MS = Number(flag("timeout", "120000"));
const DRY = has("dry-run");
const ALLOW_REMOTE = has("allow-remote");

const fail = (message, code = 1) => {
  console.error(`\n${message}\n`);
  process.exit(code);
};

for (const m of MODELS_ARG) if (!(m in MODELS)) fail(`Unknown model "${m}". The catalogue has: ${Object.keys(MODELS).join(", ")}`);
if (!(REPEATS >= 1)) fail("--repeats must be at least 1");
if (!(MAX_USD > 0)) fail("--max-usd must be positive");
if (REASONINGS.some((r) => r !== "catalogue") && !REASONING_HEADER) {
  fail(
    "The route picks reasoning from lib/models.ts and reads no per-request override, so a level other\n" +
      "than \"catalogue\" would be a label on turns that all ran at the catalogue's level. Pass\n" +
      "--reasoning-header <name> once the route honours one (docs/fit-check-at-scale.md, \"What the\n" +
      "route would need\"), or run --reasoning catalogue.",
  );
}

// --- where it may send ------------------------------------------------------------------

let baseUrl;
try {
  baseUrl = new URL(BASE);
} catch {
  fail(`--base ${BASE} is not a URL`);
}
if (/(^|\.)sidhantmathur\.com$/i.test(baseUrl.hostname)) {
  fail("Refusing to run against the production site. Point --base at a local server.");
}
const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(baseUrl.hostname);
if (!local && !ALLOW_REMOTE && !DRY) {
  fail(
    `Refusing a non-local --base (${baseUrl.host}) without --allow-remote. A deployed server spends\n` +
      "from the same key as production, and behind Vercel's proxy the per-turn --ip buckets don't work.",
  );
}

// --- the plan -------------------------------------------------------------------------------

const { file: corpusFile, postings: corpus } = readCorpus(POSTINGS);
const selected = selectPostings(corpus, {
  ids: list("ids"),
  families: list("family"),
  controls: list("control"),
  perStratum: flag("per-stratum", null) ? Number(flag("per-stratum")) : undefined,
  sample: flag("sample", null) ? Number(flag("sample")) : undefined,
  limit: flag("limit", null) ? Number(flag("limit")) : undefined,
  seed: flag("seed", "fit"),
});
if (!selected.length) fail(`No postings selected from ${corpusFile}.`);

const cells = planCells({ postings: selected, models: MODELS_ARG, reasonings: REASONINGS, repeats: REPEATS });
const prior = readResults(OUT);
const done = finishedKeys(prior);
const todo = cells.filter((c) => !done.has(c.key));
const alreadySpent = spentSoFar(prior);

if (todo.length > 20 && !IP && !DRY) {
  fail(
    `This plan sends ${todo.length} turns and the route allows 20 per IP per hour. Pass --ip <prefix> so\n` +
      "each turn gets its own rate-limit bucket (see evals/run-live.mjs for what that costs).",
  );
}

const sentChars = (p) => Math.min(p.text.length, MAX_POSTING_TEXT);

function printPlan() {
  const strata = new Map();
  for (const p of selected) strata.set(stratumOf(p), (strata.get(stratumOf(p)) ?? 0) + 1);
  console.log(`\nFit-check stability — ${DRY ? "dry run" : `against ${BASE}`}`);
  console.log(`  corpus     ${corpusFile} (${corpus.length} postings), ${selected.length} selected`);
  console.log(`  strata     ${[...strata].map(([k, n]) => `${k} ${n}`).join(", ")}`);
  console.log(`  settings   ${MODELS_ARG.join(", ")} × reasoning ${REASONINGS.join(", ")} × ${REPEATS} repeat(s)`);
  console.log(`  turns      ${cells.length} planned, ${cells.length - todo.length} already done, ${todo.length} to send`);
  console.log(`  output     ${OUT}`);

  const bySetting = new Map();
  for (const c of todo) {
    const k = `${c.model}|${c.reasoning}`;
    if (!bySetting.has(k)) bySetting.set(k, { turns: 0, expected: 0, high: 0, billedHigh: 0, ceiling: 0, sec: 0, unmeasured: 0, inexact: false });
    const s = bySetting.get(k);
    const proj = projectTurnUsd({ model: c.model, reasoning: c.reasoning, chars: sentChars(c.posting) });
    const ceil = ceilingTurnUsd({ model: c.model, chars: sentChars(c.posting) });
    s.turns += 1;
    s.ceiling += ceil ?? 0;
    if (proj) {
      s.expected += proj.expected;
      s.high += proj.high;
      s.billedHigh += proj.billedHigh;
      s.sec += proj.doneSec;
      if (!proj.exact) s.inexact = true;
    } else {
      s.unmeasured += 1;
    }
  }
  console.log("\n  Projected cost (list price, from the measured posting turns in docs/followups.md, scaled by length):");
  console.log("    setting                                           turns   expected       high    ceiling    hours");
  let totalExpected = 0;
  let totalHigh = 0;
  let totalCeiling = 0;
  for (const [k, s] of bySetting) {
    totalExpected += s.expected;
    totalHigh += s.billedHigh;
    totalCeiling += s.ceiling;
    const note = s.unmeasured ? `  (${s.unmeasured} unmeasured)` : s.inexact ? "  (no measurement at this level: model's default used)" : "";
    console.log(
      `    ${k.padEnd(48)} ${String(s.turns).padStart(6)} ${formatUsd(s.expected).padStart(10)} ${formatUsd(s.billedHigh).padStart(10)} ${formatUsd(s.ceiling).padStart(10)} ${(s.sec / 3600 / CONCURRENCY).toFixed(1).padStart(8)}${note}`,
    );
  }
  console.log(`    ${"total".padEnd(48)} ${String(todo.length).padStart(6)} ${formatUsd(totalExpected).padStart(10)} ${formatUsd(totalHigh).padStart(10)} ${formatUsd(totalCeiling).padStart(10)}`);
  console.log(`\n  Cap ${formatUsd(MAX_USD, 2)}${alreadySpent ? `, ${formatUsd(alreadySpent)} already spent by earlier invocations` : ""}.`);
  if (totalHigh + alreadySpent > MAX_USD) {
    console.log(`  The high estimate is over the cap: the run would stop part-way, at about ${Math.floor(todo.length * ((MAX_USD - alreadySpent) / totalHigh))} of ${todo.length} turns.`);
  } else if (totalCeiling + alreadySpent > MAX_USD) {
    console.log("  Fits under the cap at the high estimate. (The ceiling is the guard's worst case per turn, which no measured turn came near.)");
  } else {
    console.log("  Fits under the cap even if every turn cost its ceiling.");
  }
  return { totalExpected, totalHigh, totalCeiling };
}

// --- run -------------------------------------------------------------------------------------

// The chunks the site checks citations against: the record and the repo
// corpus, as lib/corpus.ts builds ALL_CHUNKS_BY_ID. Built by `npm run eval`'s
// first two steps; a dry run doesn't need them.
let lookup = null;
function loadLookup() {
  try {
    return Object.fromEntries([...readChunks(), ...readRepoChunks()].map((c) => [c.id, c]));
  } catch {
    fail("The chunk corpus isn't built. Run `node scripts/build-knowledge.mjs && node scripts/build-repo-corpus.mjs` first.");
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  printPlan();
  if (DRY) {
    console.log("\n  Dry run: nothing was sent.\n");
    return 0;
  }
  if (!todo.length) {
    console.log("\n  Every planned turn is already in the results file. Nothing to send.\n");
    return 0;
  }
  lookup = loadLookup();

  // The Gateway's meter, before anything is sent.
  const key = process.env.AI_GATEWAY_API_KEY;
  let creditsBefore = null;
  if (!NO_CREDITS) {
    if (!key) {
      fail(
        "The runner reads the Gateway's credits endpoint before, during and after a run, which needs\n" +
          "AI_GATEWAY_API_KEY in the runner's own environment (node --env-file=.env.local …). Pass\n" +
          "--no-credits to rely on the list-price cap alone, as against the mock.",
      );
    }
    try {
      creditsBefore = await readCredits(key);
    } catch (err) {
      fail(`Could not read the Gateway's credits (${err.message}). Not starting a run blind; pass --no-credits to override.`);
    }
    console.log(`\n  Gateway before: balance ${creditsBefore.balance ?? "?"}, total used ${creditsBefore.totalUsed ?? "?"}`);
    if (creditsBefore.balance != null && creditsBefore.balance - MAX_USD < RESERVE_USD) {
      fail(
        `The balance (${formatUsd(creditsBefore.balance, 2)}) less this run's cap (${formatUsd(MAX_USD, 2)}) would leave under\n` +
          `--reserve-usd ${formatUsd(RESERVE_USD, 2)} for production. Lower --max-usd or top up first.`,
      );
    }
  } else {
    console.log("\n  --no-credits: the list-price cap is the only guard on this run.");
  }

  mkdirSync(dirname(OUT), { recursive: true });
  const guard = new SpendGuard({ maxUsd: MAX_USD, alreadySpentUsd: alreadySpent });
  const runId = new Date().toISOString();
  let stopReason = null;
  let settledTurns = 0;
  let consecutiveTransport = 0;
  let badRequests = 0;
  let index = 0;
  const tally = { ok: 0, failed: 0 };
  let interrupted = false;
  process.on("SIGINT", () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    stopReason = stopReason ?? "interrupted (Ctrl-C); finishing the turns in flight";
    console.log(`\n  ${stopReason}`);
  });

  async function checkCredits() {
    if (NO_CREDITS || creditsBefore?.totalUsed == null) return;
    try {
      const now = await readCredits(key);
      const billed = now.totalUsed - creditsBefore.totalUsed;
      console.log(`  · Gateway: ${formatUsd(billed)} billed since the start (an upper bound: production shares the key)`);
      if (billed > MAX_USD) stopReason = stopReason ?? `the Gateway billed ${formatUsd(billed)}, over the ${formatUsd(MAX_USD, 2)} cap`;
    } catch (err) {
      stopReason = stopReason ?? `the credits endpoint stopped answering (${err.message})`;
    }
  }

  async function worker() {
    while (!stopReason) {
      const cell = todo[index++];
      if (!cell) return;
      const chars = sentChars(cell.posting);
      const ceiling = ceilingTurnUsd({ model: cell.model, chars });
      let hold = guard.tryReserve(ceiling);
      // Other turns in flight hold their ceilings; once they settle to what
      // they really cost there may be room. Only an empty guard is final.
      while (hold == null && guard.reserved > 0 && !stopReason) {
        await sleep(100);
        hold = guard.tryReserve(ceiling);
      }
      if (hold == null) {
        stopReason = stopReason ?? `the spend cap: ${formatUsd(guard.committed)} committed, and the next turn could cost up to ${formatUsd(ceiling)}`;
        return;
      }
      const body = jdRequestBody({
        posting: cell.posting.text,
        model: cell.model,
        chatId: `fit-${cell.key}`.replace(/[^a-z0-9-]+/gi, "-").slice(0, 80),
        messageId: `m-${cell.repeat}`,
      });
      assertSendable(body);
      const headers = {
        ...(IP ? { "x-forwarded-for": `${IP}-${cell.key}`.replace(/[^a-z0-9.-]+/gi, "-") } : {}),
        ...(REASONING_HEADER && cell.requested !== "catalogue" ? { [REASONING_HEADER]: cell.requested } : {}),
      };
      const startedAt = new Date().toISOString();
      const turn = await runTurn({ base: BASE, body, headers, timeoutMs: TIMEOUT_MS });

      if (!turn.reachedServer) guard.release(hold);
      const summary = turn.stream || turn.status === "http-error" ? summarizeTurn(turn, { model: cell.model, lookup }) : { status: turn.status, error: turn.error };
      // An early-exit error never reached the model, so it cost nothing.
      const charged = turn.reachedServer
        ? guard.settle(hold, turn.status === "http-error" ? 0 : chargeFor(cell.model, summary.costUsd ?? null))
        : 0;

      const record = {
        v: 1,
        runId,
        key: cell.key,
        postingId: cell.posting.id,
        company: cell.posting.company,
        title: cell.posting.title,
        family: cell.posting.family,
        control: cell.posting.control ?? "none",
        controlKind: cell.posting.controlKind ?? null,
        model: cell.model,
        reasoning: cell.reasoning,
        reasoningVia: cell.requested === "catalogue" ? "catalogue" : `header:${REASONING_HEADER}`,
        repeat: cell.repeat,
        base: BASE,
        startedAt,
        postingChars: cell.posting.text.length,
        sentChars: chars,
        cutBySite: cell.posting.text.length > MAX_POSTING_TEXT,
        ...summary,
        chargedUsd: charged,
      };
      appendFileSync(OUT, `${JSON.stringify(record)}\n`);

      const label = `${cell.posting.company} — ${cell.posting.title}`.slice(0, 58);
      if (turn.status === "ok") {
        tally.ok += 1;
        consecutiveTransport = 0;
        const c = summary.counts;
        const counts = c ? `${c.met}/${c.partial}/${c.unmet}/${c.unclear}` : "no card";
        console.log(
          `  ok    r${cell.repeat} ${cell.model.split("/")[1]} ${label.padEnd(58)} ${String(summary.requirementCount ?? "-").padStart(2)} req  ${counts.padEnd(11)} card ${((summary.timings.cardMs ?? 0) / 1000).toFixed(1)}s  ${formatUsd(summary.costUsd ?? NaN)}`,
        );
        // A `none` level that still reports reasoning tokens means the server
        // ignored the header: every turn after this would be mislabelled.
        if (cell.requested === "none" && (summary.telemetry?.usage?.reasoningTokens ?? 0) > 0) {
          stopReason = stopReason ?? `the server ran a "none" turn with ${summary.telemetry.usage.reasoningTokens} reasoning tokens: it is not honouring ${REASONING_HEADER}`;
        }
      } else {
        tally.failed += 1;
        console.log(`  ${turn.status.toUpperCase()} r${cell.repeat} ${label}: ${turn.errorClass ?? turn.error ?? ""}`);
        if (turn.status === "http-error" && turn.httpStatus === 502 && turn.errorClass === "upstream_unconfigured") {
          stopReason = stopReason ?? "the server has no AI_GATEWAY_API_KEY (HTTP 502, upstream_unconfigured). Nothing was spent.";
        } else if (turn.status === "http-error" && turn.httpStatus === 429) {
          stopReason = stopReason ?? (IP ? "rate limited even with --ip: this server doesn't trust x-forwarded-for, so the per-turn buckets aren't working" : "rate limited: pass --ip <prefix>");
        } else if (turn.status === "http-error" && turn.httpStatus === 400 && ++badRequests >= 3) {
          stopReason = stopReason ?? "three requests rejected as invalid (HTTP 400): the request shape has drifted from the route's";
        } else if ((turn.status === "transport-error" || turn.status === "timeout") && ++consecutiveTransport >= 3) {
          stopReason = stopReason ?? `three transport failures in a row (${turn.error}). Is the server running at ${BASE}?`;
        }
      }

      settledTurns += 1;
      if (CREDITS_EVERY > 0 && settledTurns % CREDITS_EVERY === 0) await checkCredits();
      if (DELAY_MS && !stopReason) await sleep(DELAY_MS);
    }
  }

  console.log(`\n  Sending ${todo.length} turn(s), ${CONCURRENCY} at a time.\n`);
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${tally.ok} ok, ${tally.failed} failed, ${todo.length - tally.ok - tally.failed} not sent`);
  console.log(`  List price this invocation: ${formatUsd(guard.settled - alreadySpent)} (run total ${formatUsd(guard.settled)} of the ${formatUsd(MAX_USD, 2)} cap)`);
  if (!NO_CREDITS && creditsBefore) {
    try {
      const after = await readCredits(key);
      console.log(`  Gateway after: balance ${after.balance ?? "?"}, billed ${formatUsd(after.totalUsed - creditsBefore.totalUsed)} since the start (upper bound)`);
    } catch (err) {
      console.log(`  Gateway after: could not read (${err.message})`);
    }
  }
  console.log(`  Results: ${OUT}`);
  console.log("  Report:  node scripts/report-fit-stability.mjs");
  if (stopReason) {
    console.log(`\n  Stopped: ${stopReason}`);
    if (/spend cap|billed/.test(stopReason)) return 5;
    if (/AI_GATEWAY_API_KEY/.test(stopReason)) return 3;
    if (/rate limited/.test(stopReason)) return 4;
    if (/interrupted/.test(stopReason)) return 130;
    return 2;
  }
  console.log("");
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`\nrun-fit-stability failed: ${err.stack ?? err.message}`);
    process.exit(1);
  });
