// Layer 2 — runs the eval corpus against a REAL running server.
//
// This hits /api/chat over HTTP rather than reimplementing the route, so what
// it measures is the actual system: the real system prompt, the real tools, the
// real allowlist, the real rate limiter. A harness that rebuilt the prompt
// itself would drift from production and quietly start grading a fiction.
//
// Requires:
//   1. A running server        — `npm run dev` (or `npm run build && npm start`)
//   2. AI_GATEWAY_API_KEY set  — in .env.local, read by the server, not by this
//
// Usage:
//   npm run eval:live                        # every group (22 cases — see note)
//   npm run eval:live -- --group roleFit     # just the job-description cases
//   npm run eval:live -- --model openai/gpt-5-mini
//   npm run eval:live -- --base http://localhost:3001
//
// RATE LIMIT NOTE: the standard tier allows 20 requests/hour per IP, and the
// full corpus is 22 cases — two over. A full run WILL be cut short. Run one
// group at a time; the runner reports where it stopped. With
// no Upstash env vars the limiter falls back to an in-memory store scoped to
// the server process, so restarting the dev server resets the budget.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ALL_GROUPS, REFUSAL_MARKERS, SOFT_PEDAL_PATTERNS } from "./cases.mjs";
import { ROOT, readChunks } from "./lib/artifacts.mjs";
import { verifyAnswer } from "../lib/verify.ts";

// The corpus, for the Sprint 3 citation pass below.
const CHUNK_BY_ID = Object.fromEntries(readChunks().map((c) => [c.id, c]));

// --- args -----------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = flag("base", "http://localhost:3000").replace(/\/$/, "");
const MODEL = flag("model", null);
const GROUP = flag("group", null);
const DELAY_MS = Number(flag("delay", "500"));
// Rate-limit bucket PREFIX. The route keys its hourly budget on
// `x-forwarded-for`; given a prefix, this runner sends a distinct bucket per
// case, so a corpus longer than the hourly budget runs end to end instead of
// stopping two cases short — and a five-model bake-off is five full runs rather
// than one visitor's 20 turns divided five ways.
//
// What that costs, said plainly: a run with `--ip` set is NOT shaped by the
// rate limiter, so it measures the models and says nothing about the budget.
// The limiter has its own assertions in the static suite; this is not where it
// gets tested. Left unset, the runner sends no such header and spends exactly
// the budget a visitor would — which is the default for that reason.
//
// It is a plain request header, so it only does anything against a server that
// trusts the header. Localhost does. The deployed site, behind Vercel's proxy,
// does not — the proxy overwrites it.
const IP = flag("ip", null);

const groups = GROUP
  ? { [GROUP]: ALL_GROUPS[GROUP] }
  : ALL_GROUPS;

if (GROUP && !ALL_GROUPS[GROUP]) {
  console.error(`Unknown group "${GROUP}". Options: ${Object.keys(ALL_GROUPS).join(", ")}`);
  process.exit(1);
}

// --- transport ------------------------------------------------------------

class RateLimited extends Error {}

/**
 * Sends one user turn and collects the streamed reply.
 *
 * The response is an AI SDK UI message stream (SSE). Rather than hard-coding
 * one event shape, this reads tolerantly: any event carrying a text delta
 * contributes to the answer, any event naming a tool is recorded, and any tool
 * output is captured. A wire-format change in the SDK should degrade this to
 * missing metadata, not to a crash that looks like a model failure.
 */
async function ask(text, bucket) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(IP ? { "x-forwarded-for": `${IP}-${bucket}` } : {}),
    },
    body: JSON.stringify({
      messages: [{ id: "eval-1", role: "user", parts: [{ type: "text", text }] }],
      ...(MODEL ? { model: MODEL } : {}),
    }),
  });

  if (res.status === 429) throw new RateLimited("rate_limited");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
  }

  const raw = await res.text();
  let answer = "";
  let streamError = null;
  let telemetry = null;
  const toolNames = [];
  const toolOutputs = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;

    let event;
    try {
      event = JSON.parse(payload);
    } catch {
      continue;
    }

    const type = typeof event.type === "string" ? event.type : "";
    // A turn that fails mid-stream returns HTTP 200 with an error chunk in the
    // body. Before this was read, such a turn arrived here as an empty answer
    // with no tool calls — indistinguishable from a model that chose to say
    // nothing, and scored as a model failure. It is not one.
    if (type === "error" && typeof event.errorText === "string") {
      streamError = event.errorText;
    }
    // The Sprint 1 telemetry part (lib/chat-telemetry.ts). Written twice under
    // one id; the last write is the complete one.
    if (type === "data-turn" && event.data) {
      telemetry = event.data;
    }
    if (type.includes("text")) {
      if (typeof event.delta === "string") answer += event.delta;
      else if (typeof event.textDelta === "string") answer += event.textDelta;
      else if (typeof event.text === "string" && type !== "text-start") answer += event.text;
    }
    if (typeof event.toolName === "string" && !toolNames.includes(event.toolName)) {
      toolNames.push(event.toolName);
    }
    if (event.output != null && typeof event.output === "object") {
      toolOutputs.push(event.output);
    }
  }

  return {
    answer,
    streamError,
    telemetry,
    toolNames,
    toolOutputs,
    model: res.headers.get("x-model"),
    tier: res.headers.get("x-tier"),
    remaining: Number(res.headers.get("x-tier-remaining")),
  };
}

// --- scoring --------------------------------------------------------------

const hasAny = (haystack, needles) =>
  needles.some((n) => haystack.toLowerCase().includes(n.toLowerCase()));

const looksLikeRefusal = (text) => hasAny(text, REFUSAL_MARKERS);

function scoreSimple(testCase, result) {
  const { expect = {} } = testCase;
  const text = result.answer;
  const failures = [];

  if (expect.includesAny && !hasAny(text, expect.includesAny)) {
    failures.push(`expected one of [${expect.includesAny.join(", ")}]`);
  }
  if (expect.includesAnySecond && !hasAny(text, expect.includesAnySecond)) {
    failures.push(`expected one of [${expect.includesAnySecond.join(", ")}]`);
  }
  if (expect.excludes) {
    const leaked = expect.excludes.filter((n) => text.toLowerCase().includes(n.toLowerCase()));
    if (leaked.length) failures.push(`leaked [${leaked.join(", ")}]`);
  }
  if (expect.refuses && !looksLikeRefusal(text)) {
    failures.push("expected a refusal / no-information response");
  }

  return { pass: failures.length === 0, failures };
}

/**
 * Scores a job-description case.
 *
 * Reports separately, because these fail independently and the difference
 * between them is the whole diagnosis:
 *
 *   - was the gap named ANYWHERE?      (did the model notice)
 *   - was it named in `gaps`?          (did it land where the feature promises)
 *   - was it softened as it was named? (the sycophancy failure mode)
 *   - did every requirement get a row?  (Sprint 4 — coverage)
 *
 * Sprint 4 note: the structured assessment is now the RECONCILED object from
 * lib/role-fit.ts, not the model's raw one. That's deliberate — what a visitor
 * sees is what the reconciler returned, so that's what the evals grade.
 */
function scoreRoleFit(testCase, result) {
  const { expect = {} } = testCase;
  const text = result.answer;
  // The extraction returns `requirements` (strings), the assessment returns
  // `rows` (judged) — the reconciled object from lib/role-fit.ts.
  const roleFit = result.toolOutputs.find((o) => o.counts && Array.isArray(o.rows)) ?? null;
  const rows = roleFit?.rows ?? [];
  const gapList = Array.isArray(roleFit?.gaps) ? roleFit.gaps : [];
  const gapText = gapList.join("\n");
  // Rows count as gap-naming too: a requirement tagged `unmet` has named the
  // shortfall structurally, which is the whole point of the new shape.
  //
  // A `partial` row counts as well, but only through its EVIDENCE. The
  // requirement text is the posting's words, and a model could otherwise pass
  // a gap assertion by echoing the posting under a flattering sentence — the
  // soft-pedal wearing a tag. What has to name the shortfall is the model's own
  // sentence. (Measured: a real run tagged "Strong SQL, and dbt modeling
  // against a warehouse" partial, which is the honest read of a requirement
  // bundling something he has with something he doesn't.)
  const unmetText = rows
    .filter((r) => r?.verdict === "unmet" || r?.verdict === "unclear")
    .map((r) => `${r?.requirement ?? ""} ${r?.evidence ?? ""}`)
    .join("\n");
  const partialText = rows
    .filter((r) => r?.verdict === "partial")
    .map((r) => r?.evidence ?? "")
    .join("\n");
  const structured = `${gapText}\n${unmetText}\n${partialText}`;
  const combined = `${text}\n${structured}`;

  const failures = [];
  const notes = [];

  if (expect.callsRoleFit && !result.toolNames.includes("roleFit")) {
    failures.push("did not call the roleFit tool");
  }
  if (expect.callsRoleFit && !result.toolNames.includes("extractRequirements")) {
    // The extraction is what the coverage check holds the assessment to. A turn
    // that skipped it produced an assessment nothing was measured against.
    failures.push("did not call extractRequirements before assessing");
  }
  if (expect.excludes) {
    const leaked = expect.excludes.filter((n) => combined.toLowerCase().includes(n.toLowerCase()));
    if (leaked.length) failures.push(`leaked [${leaked.join(", ")}]`);
  }

  // Overclaim check, scoped to the EVIDENCE on rows tagged as a fit — the only
  // place the model asserts a skill Sidhant HAS. Checking the whole answer
  // would fail on an honest "he does not have X", which is the opposite
  // failure; checking `requirement` too would fail on the posting's own words
  // (its "Looker, Power BI, or Tableau" line is the input, not a claim).
  if (expect.forbiddenInMatches && roleFit) {
    const claimed = rows
      .filter((r) => r?.verdict === "met" || r?.verdict === "partial")
      .map((r) => r?.evidence ?? "")
      .join("\n");
    const overclaimed = expect.forbiddenInMatches.filter((n) =>
      claimed.toLowerCase().includes(n.toLowerCase()),
    );
    if (overclaimed.length) failures.push(`claimed as a match: [${overclaimed.join(", ")}]`);
  }

  const gapResults = (expect.gaps ?? []).map((gap) => {
    const inStructure = hasAny(structured, gap.patterns);
    const anywhere = hasAny(combined, gap.patterns);
    if (!anywhere) failures.push(`never named the gap: ${gap.label}`);
    else if (!inStructure) notes.push(`gap named in prose but NOT in the assessment: ${gap.label}`);
    return { label: gap.label, inStructure, anywhere };
  });

  // Only meaningful when a structured assessment was actually produced —
  // otherwise "did not call the roleFit tool" already says it, and reporting
  // both makes one problem look like two.
  if (expect.gaps?.length && roleFit && !gapList.length) {
    failures.push("gaps was empty on a posting with known gaps");
  }

  const softPedals = SOFT_PEDAL_PATTERNS.filter((re) => re.test(combined)).map((re) => re.source);
  if (softPedals.length) notes.push(`soft-pedal phrasing: ${softPedals.length} pattern(s)`);

  // What the reconciler had to fix. Reported, never failed: these are the
  // measurements the sprint exists to produce, and a run where they're all zero
  // is a run where the model did the work itself.
  if (roleFit?.uncovered) {
    notes.push(`${roleFit.uncovered} extracted requirement(s) the assessment skipped`);
  }
  const downgraded = rows.filter((r) => r?.downgrade === "uncited").length;
  if (downgraded) notes.push(`${downgraded} row(s) downgraded for citing nothing`);
  const unverified = rows.filter((r) => r?.unverified?.length).length;
  if (unverified) notes.push(`${unverified} row(s) cited a chunk that doesn't contain the claim`);

  return {
    pass: failures.length === 0,
    failures,
    notes,
    detail: {
      gaps: gapResults,
      modelGaps: gapList,
      softPedals,
      rows: rows.map((r) => ({
        requirement: r?.requirement,
        evidence: r?.evidence,
        verdict: r?.verdict,
        claimedVerdict: r?.claimedVerdict ?? null,
        downgrade: r?.downgrade ?? null,
        sources: r?.sources ?? [],
        unverified: r?.unverified ?? [],
      })),
      counts: roleFit?.counts ?? null,
    },
  };
}

/**
 * What the site's own checker (lib/verify.ts) makes of a real answer: which
 * chunks it cited, how many of its claims stood up, and — the interesting
 * number — which ones the site will render as unverified to a visitor.
 */
function summarizeCitations(answer) {
  const check = verifyAnswer(answer, CHUNK_BY_ID);
  return {
    citedIds: check.citedIds,
    unknownIds: check.unknownIds,
    claims: check.claims.length,
    verified: check.verified,
    downgraded: check.downgraded.map((c) =>
      c.verdict === "uncited"
        ? `uncited: "${c.text.slice(0, 60)}"`
        : `unverified: ${c.missing.join(", ") || c.unknownIds.join(", ")} not in ${c.ids.join(", ")}`,
    ),
  };
}

// --- run ------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\nEvals — live run against ${BASE}${MODEL ? ` (model: ${MODEL})` : ""}\n`);

  // When the measuring happened, recorded by the thing that did it. The
  // publisher used to infer this from the results file's mtime, which is the
  // best available evidence only while nobody has touched the file since.
  const startedAt = new Date().toISOString();
  const results = [];
  let rateLimitedAt = null;

  outer: for (const [groupName, cases] of Object.entries(groups)) {
    console.log(`\n${groupName}`);
    console.log("─".repeat(60));

    for (const testCase of cases) {
      const prompt = groupName === "roleFit" ? testCase.posting : testCase.prompt;
      let result;
      try {
        result = await ask(prompt, `${groupName}-${testCase.id}`);
      } catch (err) {
        if (err instanceof RateLimited) {
          rateLimitedAt = testCase.id;
          console.log(`  … stopped: rate limited before "${testCase.id}"`);
          break outer;
        }
        // A request that never reached the model is a TRANSPORT failure, and
        // the rest of this file is careful to keep those separate from a model
        // answering badly — but this path was not, and recorded a plain
        // `pass: false`. A bake-off whose server went away mid-run therefore
        // published a model at "13/22 passed" when nine of those nine failures
        // were `fetch failed` and the model never saw the question. Marked as
        // what it is, so it is counted with the other broken turns and scored
        // as none of them.
        console.log(`  BROKE ${testCase.id}: ${err.message}`);
        results.push({
          group: groupName,
          id: testCase.id,
          label: testCase.label ?? null,
          pass: false,
          broke: err.message,
          failures: [err.message],
          notes: [],
          detail: null,
          telemetry: null,
          citations: null,
        });
        continue;
      }

      // A turn that broke is not a turn that answered badly. Scoring a
      // transport failure against the model's judgment is how a working
      // feature gets "fixed" for a problem it never had — so these are marked
      // BROKE, reported separately, and never scored.
      const broke = result.streamError ?? null;
      const scored = broke
        ? { pass: false, failures: [`stream error: ${broke}`], notes: [], detail: null }
        : groupName === "roleFit"
          ? scoreRoleFit(testCase, result)
          : scoreSimple(testCase, result);

      // Sprint 3's citation pass, run over the real answer with the real
      // corpus. REPORTED, NOT SCORED — the same call as soft-pedal phrasing.
      // A model that cites badly is a prompt problem worth seeing, but making
      // it a failure would turn every model swap into a red suite and tempt
      // whoever's on the hook into loosening the checker, which is the one
      // thing that must never happen to it.
      const citations = broke ? null : summarizeCitations(result.answer);
      const mark = broke ? "BROKE" : scored.pass ? "pass" : "FAIL";
      console.log(`  ${mark}  ${testCase.id}${testCase.label ? ` — ${testCase.label}` : ""}`);
      for (const f of scored.failures) console.log(`        ✗ ${f}`);
      for (const n of scored.notes ?? []) console.log(`        ! ${n}`);
      // Cheap, and it catches the truncation case: a turn that stops on
      // `length` with nothing to show spent its whole output budget on
      // reasoning tokens, which reads as a silent refusal without this line.
      if (result.telemetry?.finishReason && result.telemetry.finishReason !== "stop") {
        console.log(`        ! finish reason: ${result.telemetry.finishReason}`);
      }
      if (citations?.claims) {
        console.log(
          `        · cited ${citations.citedIds.length} chunk(s), ` +
            `${citations.verified}/${citations.claims} claim(s) verified` +
            (citations.unknownIds.length ? `, invented ids: ${citations.unknownIds.join(", ")}` : ""),
        );
        for (const line of citations.downgraded) console.log(`        · ${line}`);
      }

      results.push({
        group: groupName,
        id: testCase.id,
        label: testCase.label ?? null,
        pass: scored.pass,
        broke,
        failures: scored.failures,
        notes: scored.notes ?? [],
        detail: scored.detail ?? null,
        model: result.model,
        // The full Sprint 1 telemetry record for this turn: tokens, cache hit,
        // TTFT, tokens/sec, steps, tools, finish reason, error class.
        telemetry: result.telemetry,
        citations,
        answer: result.answer,
        toolNames: result.toolNames,
      });

      if (DELAY_MS) await sleep(DELAY_MS);
    }
  }

  // --- summary ------------------------------------------------------------

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${"═".repeat(60)}`);
  console.log(`${passed}/${results.length} passed`);

  for (const [groupName] of Object.entries(groups)) {
    const inGroup = results.filter((r) => r.group === groupName);
    if (!inGroup.length) continue;
    console.log(`  ${groupName}: ${inGroup.filter((r) => r.pass).length}/${inGroup.length}`);
  }

  const brokeCount = results.filter((r) => r.broke).length;
  if (brokeCount) {
    console.log(
      `\n  ${brokeCount} turn(s) failed in transport, not in judgment — these say nothing about the model.`,
    );
  }

  const softPedalCount = results.filter((r) => r.detail?.softPedals?.length).length;
  if (softPedalCount) {
    console.log(`\n  ${softPedalCount} assessment(s) contained soft-pedal phrasing — read the JSON.`);
  }

  const cited = results.filter((r) => r.citations?.claims);
  if (cited.length) {
    const claims = cited.reduce((n, r) => n + r.citations.claims, 0);
    const verified = cited.reduce((n, r) => n + r.citations.verified, 0);
    console.log(`\n  Citations: ${verified}/${claims} claim(s) verified across ${cited.length} answer(s).`);
    const invented = cited.flatMap((r) => r.citations.unknownIds);
    if (invented.length) {
      console.log(`  ${invented.length} invented id(s): ${[...new Set(invented)].join(", ")}`);
    }
  }
  if (rateLimitedAt) {
    console.log(`\n  Run was cut short by the rate limit at "${rateLimitedAt}".`);
    console.log("  Re-run one group at a time, or restart the dev server to reset the in-memory budget.");
  }

  const target = join(ROOT, "evals", "results.json");
  writeFileSync(
    target,
    JSON.stringify(
      {
        base: BASE,
        model: MODEL,
        startedAt,
        finishedAt: new Date().toISOString(),
        rateLimitedAt,
        passed,
        total: results.length,
        results,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\n  Wrote evals/results.json\n`);

  // Non-zero exit on failure so this can gate CI later.
  process.exit(results.some((r) => !r.pass) ? 1 : 0);
}

main().catch((err) => {
  console.error(`\nEval run failed: ${err.message}`);
  if (err.cause?.code === "ECONNREFUSED") {
    console.error(`Is the server running at ${BASE}? Start it with \`npm run dev\`.\n`);
  }
  process.exit(1);
});
