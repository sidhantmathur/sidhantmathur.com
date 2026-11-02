// Renders the corpus and a stability run into docs/fit-check-at-scale.md.
//
// The doc is mostly prose; this script owns only the blocks between
// `<!-- generated:NAME -->` and `<!-- /generated:NAME -->` markers and
// rewrites them in place:
//
//   corpus      what's in evals/postings/corpus.jsonl, and the length-cap finding
//   projection  projected cost per model and reasoning level, from the measured turns
//   results     the latest run in the results file, if there is one
//
// It prints numbers and posting titles only. Row evidence and answers are
// unreviewed model output making claims about Sidhant, and they stay in the
// git-ignored results file.
//
// Usage:
//   node scripts/report-fit-stability.mjs
//   node scripts/report-fit-stability.mjs --results evals/postings/runs/mock.jsonl
//   node scripts/report-fit-stability.mjs --stdout          # print, don't write the doc

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MAX_POSTING_TEXT, MAX_USER_TEXT } from "../lib/job-posting.ts";
import { MODELS, reasoningFor } from "../lib/models.ts";
import { formatUsd } from "../lib/pricing.ts";
import { CONTROLS, FAMILIES } from "../evals/lib/postings.mjs";
import {
  MEASURED_POSTING_TURNS,
  aggregateSetting,
  ceilingTurnUsd,
  percentile,
  postingAgreement,
  projectTurnUsd,
  readCorpus,
  readResults,
  selectPostings,
  stratumOf,
} from "../evals/lib/fit-stability.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const CORPUS = resolve(ROOT, flag("corpus", "evals/postings/corpus.jsonl"));
const RESULTS = resolve(ROOT, flag("results", "evals/postings/runs/fit-stability.jsonl"));
const DOC = resolve(ROOT, flag("doc", "docs/fit-check-at-scale.md"));
const STDOUT = args.includes("--stdout");

// The recommended first run (docs/fit-check-at-scale.md). Kept here so the
// doc's projection is computed from the same selection the command makes.
const FIRST_RUN = { perStratum: 10, repeats: 3, seed: "fit", models: ["openai/gpt-6-luna"], reasoning: "catalogue" };

// --- formatting -------------------------------------------------------------------

const pct = (x, digits = 0) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(digits)}%`);
const ratio = (r) => (!r || !r.den ? "—" : `${r.num}/${r.den} (${pct(r.rate)})`);
const num = (x) => (x == null ? "—" : Number.isInteger(x) ? x.toLocaleString("en-US") : x.toFixed(1));
const secs = (ms) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`);
const dist = (d, f = num) => (d ? `${f(d.p50)} / ${f(d.p90)} / ${f(d.max)}` : "—");

function table(head, rows) {
  const line = (cells) => `| ${cells.join(" | ")} |`;
  return [line(head), line(head.map(() => "---")), ...rows.map(line)].join("\n");
}

// --- corpus -----------------------------------------------------------------------------

function corpusBlock(postings) {
  const n = postings.length;
  const companies = new Set(postings.map((p) => p.company));
  const label = (f) => (f === "none" ? "in family" : f);
  const out = [];

  out.push(
    `${n} postings from ${companies.size} companies, fetched ${dateRange(postings.map((p) => p.fetchedAt))} from the public Greenhouse, Ashby and Lever board APIs by \`scripts/fetch-postings.mjs\`.`,
  );
  out.push("");
  const bySource = ["greenhouse", "ashby", "lever"].map((s) => [s, postings.filter((p) => p.source === s)]);
  out.push(
    table(
      ["Source", "Boards", "Postings"],
      bySource.map(([s, ps]) => [s, String(new Set(ps.map((p) => p.company)).size), String(ps.length)]),
    ),
  );
  out.push("");
  out.push("**By family and control.** Families and controls are a title heuristic (`evals/lib/postings.mjs`), not a judgment of fit.");
  out.push("");
  const familyRows = FAMILIES.map((f) => {
    const ps = postings.filter((p) => p.family === f && p.control === "none");
    return [f, String(ps.length), pct(ps.length / n), String(new Set(ps.map((p) => p.company)).size)];
  });
  for (const c of CONTROLS.filter((c) => c !== "none")) {
    const ps = postings.filter((p) => p.control === c);
    const kinds = [...new Set(ps.map((p) => p.controlKind))].map((k) => `${k} ${ps.filter((p) => p.controlKind === k).length}`).join(", ");
    familyRows.push([`${label(c)} (${kinds})`, String(ps.length), pct(ps.length / n), String(new Set(ps.map((p) => p.company)).size)]);
  }
  out.push(table(["Family / control", "Postings", "Share", "Companies"], familyRows));

  const gauntlet = ["Anthropic", "OpenAI", "Ramp", "Notion", "Harvey", "Sierra", "Decagon", "Vercel"];
  out.push("");
  out.push(
    `The gauntlet list: ${gauntlet.map((c) => `${c} ${postings.filter((p) => p.company === c).length}`).join(", ")}. In-family postings are capped at 9 per company so the largest boards don't stand in for the market.`,
  );

  // The length finding.
  const lengths = postings.map((p) => p.length);
  const cut = postings.filter((p) => p.cutBySite);
  const qualsFound = postings.filter((p) => p.qualificationsAt != null);
  const qualsLost = postings.filter((p) => p.qualificationsLost);
  const lost = cut.map((p) => p.charsLost);
  const keptShare = cut.map((p) => MAX_POSTING_TEXT / p.length);
  const roleAt = postings.map((p) => p.roleAt).filter((x) => x != null);
  const compText = postings.filter((p) => p.compensationSource === "text");
  const compPast = compText.filter((p) => {
    const at = p.text.indexOf(p.compensation);
    return at >= MAX_POSTING_TEXT;
  });
  const items = postings.map((p) => p.listItems);
  const itemsKept = postings.map((p) => p.text.slice(0, MAX_POSTING_TEXT).split("\n").filter((l) => l.startsWith("- ")).length);

  out.push("");
  out.push("<a id=\"length-finding\"></a>");
  out.push("**The length finding.**");
  out.push("");
  out.push(
    table(
      ["Measure", "Value"],
      [
        ["The paste panel's limit (`MAX_POSTING_TEXT`)", `${MAX_POSTING_TEXT.toLocaleString("en-US")} characters (the route's \`MAX_USER_TEXT\` ${MAX_USER_TEXT.toLocaleString("en-US")}, less the prefix)`],
        ["Posting length, p10 / p25 / median / p75 / p90 / max", [0.1, 0.25, 0.5, 0.75, 0.9].map((q) => num(Math.round(percentile(lengths, q)))).join(" / ") + ` / ${num(Math.max(...lengths))}`],
        ["Postings the panel cuts off", `${cut.length}/${n} (${pct(cut.length / n)})`],
        ["Characters lost when cut, median / p90", `${num(Math.round(percentile(lost, 0.5)))} / ${num(Math.round(percentile(lost, 0.9)))}`],
        ["Share of a cut posting the model sees, median", pct(percentile(keptShare, 0.5))],
        ["Qualifications section starts past the cut (the model sees none of it)", `${qualsLost.length}/${qualsFound.length} postings with a recognisable header (${pct(qualsLost.length / qualsFound.length)}); ${pct(qualsLost.length / n)} of all postings`],
        ["Company boilerplate before the role section, median", `${num(Math.round(percentile(roleAt, 0.5)))} characters (${roleAt.length} postings with a recognisable role header)`],
        ["Salary stated in the text and lost to the cut", `${compPast.length}/${compText.length}`],
        ["List items, median (whole posting / what the panel keeps)", `${num(percentile(items, 0.5))} / ${num(percentile(itemsKept, 0.5))}`],
        ["More than 14 list items, the card's row limit (whole / kept)", `${pct(items.filter((x) => x > 14).length / n)} / ${pct(itemsKept.filter((x) => x > 14).length / n)}`],
      ],
    ),
  );
  out.push("");
  const byFamily = [...FAMILIES.map((f) => [f, postings.filter((p) => p.family === f && p.control === "none")]), ["near-miss", postings.filter((p) => p.control === "near-miss")], ["mismatch", postings.filter((p) => p.control === "mismatch")]];
  out.push(
    table(
      ["Stratum", "Median length", "Cut off", "Qualifications lost"],
      byFamily.map(([f, ps]) => [f, num(Math.round(percentile(ps.map((p) => p.length), 0.5))), pct(ps.filter((p) => p.cutBySite).length / ps.length), pct(ps.filter((p) => p.qualificationsLost).length / ps.length)]),
    ),
  );
  return out.join("\n");
}

function dateRange(isoList) {
  const days = isoList.filter(Boolean).map((s) => s.slice(0, 10)).sort();
  if (!days.length) return "on an unknown date";
  return days[0] === days.at(-1) ? `on ${days[0]}` : `${days[0]} to ${days.at(-1)}`;
}

// --- projection ------------------------------------------------------------------------------

function projectionBlock(postings) {
  const chars = (p) => Math.min(p.length, MAX_POSTING_TEXT);
  const firstRun = selectPostings(postings, { perStratum: FIRST_RUN.perStratum, seed: FIRST_RUN.seed });
  const settings = Object.keys(MEASURED_POSTING_TURNS).map((k) => k.split("|"));
  const project = (ps, model, reasoning, repeats) => {
    let expected = 0;
    let high = 0;
    let billedHigh = 0;
    let ceiling = 0;
    let sec = 0;
    for (const p of ps) {
      const pr = projectTurnUsd({ model, reasoning, chars: chars(p) });
      expected += pr.expected * repeats;
      high += pr.high * repeats;
      billedHigh += pr.billedHigh * repeats;
      sec += pr.doneSec * repeats;
      ceiling += ceilingTurnUsd({ model, chars: chars(p) }) * repeats;
    }
    return { expected, high, billedHigh, ceiling, hours: sec / 3600 };
  };
  const rows = settings.map(([model, reasoning]) => {
    const catalogue = (reasoningFor(model, { jobPosting: true }) ?? "provider-default") === reasoning;
    const one = projectTurnUsd({ model, reasoning, chars: MAX_POSTING_TEXT });
    const full = project(postings, model, reasoning, 3);
    const first = project(firstRun, model, reasoning, FIRST_RUN.repeats);
    const unconfirmed = MODELS[model].confidence === "unconfirmed";
    return [
      `${model}${catalogue ? " (catalogue)" : ""}`,
      reasoning,
      String(MEASURED_POSTING_TURNS[`${model}|${reasoning}`].usd.length),
      formatUsd(one.expected),
      `${formatUsd(full.expected, 2)} – ${formatUsd(unconfirmed ? full.billedHigh : full.high, 2)}${unconfirmed ? " billed" : ""}`,
      `${full.hours.toFixed(1)} h`,
      `${formatUsd(first.expected, 2)} – ${formatUsd(unconfirmed ? first.billedHigh : first.high, 2)}`,
    ];
  });
  const out = [];
  out.push(
    `Per-turn cost is the mean of the measured posting turns in docs/followups.md (list price, the 2,500-character posting), scaled to each posting's length as sent (at most ${MAX_POSTING_TEXT.toLocaleString("en-US")} characters, so a cut posting costs what its first ${MAX_POSTING_TEXT.toLocaleString("en-US")} characters cost). The range runs to the dearest measured turn. "Billed" rows multiply by 4 for the price the Gateway actually charged an \`unconfirmed\` model (3.3x in the bake-off). Hours assume one turn at a time.`,
  );
  out.push("");
  out.push(
    table(
      ["Model", "Reasoning", "Turns measured", "Per turn at the cap", `Full corpus × 3 (${postings.length * 3} turns)`, "Full corpus time", `First run (${firstRun.length} × ${FIRST_RUN.repeats})`],
      rows,
    ),
  );
  out.push("");
  out.push(
    `Only the "(catalogue)" rows can run today: the route sets reasoning from \`lib/models.ts\` and reads no per-request level. The others need the route change described below. The spend guard's per-turn ceiling for GPT-6 Luna at the cap is ${formatUsd(ceilingTurnUsd({ model: "openai/gpt-6-luna", chars: MAX_POSTING_TEXT }))}, about ${Math.round(ceilingTurnUsd({ model: "openai/gpt-6-luna", chars: MAX_POSTING_TEXT }) / projectTurnUsd({ model: "openai/gpt-6-luna", reasoning: "low", chars: MAX_POSTING_TEXT }).expected)} times a measured turn; it only decides when the run stops, never what it spends.`,
  );
  return out.join("\n");
}

// --- results -----------------------------------------------------------------------------------

function resultsBlock(records, file) {
  if (!records.length) {
    return `No run has been recorded in \`${relative(ROOT, file)}\` on this machine. The commands above produce one.`;
  }
  const mock = records.some((r) => r.mock);
  const runs = [...new Set(records.map((r) => r.runId))];
  const out = [];
  if (mock) {
    out.push(
      "> **A mock replay, not a measurement.** These turns came from `evals/lib/mock-chat-server.mjs`, which replays one recorded fit check with seeded variation. They show the harness and this report working end to end. None of these numbers describes a model.",
    );
    out.push("");
  }
  out.push(
    `${records.length} records from ${runs.length} invocation(s), ${dateRange(records.map((r) => r.startedAt))}, against ${[...new Set(records.map((r) => r.base))].join(", ")}. Source: \`${relative(ROOT, file)}\`.`,
  );
  out.push("");

  const settings = new Map();
  for (const r of records) {
    // No "|" in a table cell: it would split the column.
    const k = `${r.model} (${r.reasoning})`;
    if (!settings.has(k)) settings.set(k, []);
    settings.get(k).push(r);
  }
  const agg = [...settings].map(([k, rs]) => [k, aggregateSetting(rs), rs]);

  out.push("**Did the card render.**");
  out.push("");
  out.push(
    table(
      ["Setting", "Turns", "Statuses", "Both tools called", "Blank", "Second card", "Would stall (>20 s gap)", "Finish reasons"],
      agg.map(([k, a]) => [
        k,
        String(a.turns),
        Object.entries(a.statuses).map(([s, n]) => `${s} ${n}`).join(", "),
        ratio(a.toolCalls.both),
        ratio(a.blank),
        ratio(a.toolCalls.duplicateCards),
        ratio(a.stalls),
        Object.entries(a.finishReasons).map(([s, n]) => `${s} ${n}`).join(", "),
      ]),
    ),
  );
  out.push("");
  out.push("**Stability across repeats.** Rows are matched by requirement text (method below); a row is unstable when the repeats that have it don't all give it the same verdict.");
  out.push("");
  out.push(
    table(
      ["Setting", "Postings compared", "Same requirement count", "Met/partial/unmet/unclear counts differ", "Unstable rows", "Met in one repeat, unmet in another", "Pairwise row agreement", "Fleiss' κ", "Rows missing from some repeat"],
      agg.map(([k, a]) => [
        k,
        String(a.comparedPostings),
        ratio(a.extractionAgrees),
        ratio(a.countsDiffer),
        ratio(a.unstableRows),
        ratio(a.metUnmetFlips),
        ratio(a.pairwiseAgreement),
        a.kappa ? `${a.kappa.value == null ? "—" : a.kappa.value.toFixed(2)} (${a.kappa.items} rows × ${a.kappa.raters})` : "—",
        ratio(a.rowsNotInEveryRepeat),
      ]),
    ),
  );
  out.push("");
  out.push("**Verdicts by control.** Share of rows. The mismatch postings should come back mostly unmet.");
  out.push("");
  const vs = (v) => ["met", "partial", "unmet", "unclear"].map((x) => pct(v[x].rate)).join(" / ");
  out.push(
    table(
      ["Setting", "In family (met / partial / unmet / unclear)", "Near miss", "Mismatch", "Mismatch cards at least half unmet or unclear"],
      agg.map(([k, a]) => [k, vs(a.verdicts.inFamily), vs(a.verdicts.nearMiss), vs(a.verdicts.mismatch), ratio(a.mismatchMostlyUnmet)]),
    ),
  );
  out.push("");
  out.push("**Citations**, checked with `lib/verify.ts` as the site checks them.");
  out.push("");
  out.push(
    table(
      ["Setting", "Met and partial rows that verify", "Answer claims that verify", "Rows downgraded for citing nothing", "Invented chunk ids"],
      agg.map(([k, a]) => [k, ratio(a.citations.positiveRows), ratio(a.citations.answerClaims), String(a.citations.uncitedDowngrades), a.citations.unknownIds.length ? a.citations.unknownIds.join(", ") : "none"]),
    ),
  );
  out.push("");
  out.push("**Cost and latency** (median / p90 / max).");
  out.push("");
  out.push(
    table(
      ["Setting", "List price per turn", "Run total (charged)", "Extraction done", "Card", "Done", "Longest gap", "Input tokens", "Output tokens", "Requirements"],
      agg.map(([k, a]) => [
        k,
        dist(a.costUsd, (x) => formatUsd(x)),
        formatUsd(a.chargedUsd),
        dist(a.timings.extractedMs, secs),
        dist(a.timings.cardMs, secs),
        dist(a.timings.doneMs, secs),
        dist(a.timings.maxGapMs, secs),
        dist(a.tokens.input),
        dist(a.tokens.output),
        dist(a.requirementCount),
      ]),
    ),
  );

  // By stratum, for the setting with the most turns.
  const [mainKey, , mainRecords] = [...agg].sort((a, b) => b[2].length - a[2].length)[0];
  const strata = [...FAMILIES, "near-miss", "mismatch"];
  out.push("");
  out.push(`**By stratum** (${mainKey}).`);
  out.push("");
  out.push(
    table(
      ["Stratum", "Postings", "Counts differ", "Unstable rows", "Unmet share"],
      strata
        .map((s) => {
          const rs = mainRecords.filter((r) => stratumOf(r) === s);
          if (!rs.length) return null;
          const a = aggregateSetting(rs);
          const rows = rs.filter((r) => r.status === "ok").flatMap((r) => r.rows ?? []);
          return [s, String(a.postings), ratio(a.countsDiffer), ratio(a.unstableRows), pct(rows.filter((r) => r.verdict === "unmet").length / (rows.length || NaN))];
        })
        .filter(Boolean),
    ),
  );

  // The postings that moved most: titles only.
  const byPosting = new Map();
  for (const r of mainRecords) {
    if (!byPosting.has(r.postingId)) byPosting.set(r.postingId, []);
    byPosting.get(r.postingId).push(r);
  }
  const worst = [...byPosting.values()]
    .map((rs) => ({ r: rs[0], a: postingAgreement(rs) }))
    .filter((x) => x.a.unstable > 0)
    .sort((x, y) => y.a.unstable - x.a.unstable || (y.a.unmetSpread ?? 0) - (x.a.unmetSpread ?? 0))
    .slice(0, 10);
  if (worst.length) {
    out.push("");
    out.push("**Most unstable postings.** Counts are met/partial/unmet/unclear per repeat.");
    out.push("");
    out.push(
      table(
        ["Company", "Posting", "Stratum", "Unstable rows", "Counts per repeat"],
        worst.map(({ r, a }) => [r.company, r.title.replace(/\|/g, "/"), stratumOf(r), `${a.unstable}/${a.compared}`, a.countTuples.join(", ")]),
      ),
    );
  }
  return out.join("\n");
}

// --- write ----------------------------------------------------------------------------------------

function replaceBlock(doc, name, body) {
  const open = `<!-- generated:${name} -->`;
  const close = `<!-- /generated:${name} -->`;
  const start = doc.indexOf(open);
  const end = doc.indexOf(close);
  if (start === -1 || end === -1 || end < start) throw new Error(`docs/fit-check-at-scale.md has no ${open} … ${close} block`);
  return `${doc.slice(0, start + open.length)}\n${body}\n${doc.slice(end)}`;
}

const { postings } = readCorpus(CORPUS);
const records = readResults(RESULTS);
const blocks = {
  corpus: corpusBlock(postings),
  projection: projectionBlock(postings),
  results: resultsBlock(records, RESULTS),
};

if (STDOUT) {
  for (const [name, body] of Object.entries(blocks)) console.log(`\n<!-- ${name} -->\n${body}\n`);
} else {
  if (!existsSync(DOC)) throw new Error(`${DOC} doesn't exist`);
  let doc = readFileSync(DOC, "utf8");
  for (const [name, body] of Object.entries(blocks)) doc = replaceBlock(doc, name, body);
  writeFileSync(DOC, doc);
  console.log(`Wrote ${relative(ROOT, DOC)}: corpus (${postings.length} postings), projection, results (${records.length} records)`);
}
