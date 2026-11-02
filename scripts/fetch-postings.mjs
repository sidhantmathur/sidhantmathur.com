// Refreshes the job-posting corpus the fit-check stability harness runs on
// (evals/postings/corpus.jsonl). See docs/fit-check-at-scale.md.
//
// Reads public job-board APIs only — Greenhouse, Ashby and Lever's posting
// endpoints, the ones their hosted career pages are built on — politely: one
// request at a time, a delay between them, a User-Agent that says who is
// asking and why, and one retry on a 429 or 5xx.
//
// Usage:
//   node scripts/fetch-postings.mjs                       # every board below
//   node scripts/fetch-postings.mjs --boards ashby:openai,greenhouse:vercel --out /tmp/x.jsonl
//   node scripts/fetch-postings.mjs --cache /tmp/boards   # reuse raw responses while iterating
//
// Flags: --out <file>, --delay <ms> (default 750), --per-company <n> (default
// 9 in-family postings per company), --cache <dir>, --boards <list>.
//
// What it keeps: postings in Sidhant's role families (RevOps, sales ops, GTM
// and business systems, sales and revenue analytics, delivery and program
// ops), plus about 10% deliberate mismatches and 5% near misses as controls,
// labelled by evals/lib/postings.mjs. Under 800 characters is dropped as a
// stub; duplicates (one role posted per city) are dropped.
//
// evals/postings/mine.jsonl is NOT written here. It is the slot for postings
// Sidhant is actually applying to, and stays out of this script's reach.

import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import {
  CONTROLS,
  FAMILIES,
  MIN_POSTING_CHARS,
  classifyPosting,
  compensationFromText,
  dedupePostings,
  hash32,
  htmlToText,
  lengthFacts,
} from "../evals/lib/postings.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const USER_AGENT =
  "sidhantmathur.com-fit-check-corpus/1.0 (+https://sidhantmathur.com; evaluation corpus for a portfolio's job-posting fit check; sequential, low volume)";

// Every board here was confirmed to exist on 2026-11-02 and to carry at least
// one posting in the role families. AI-forward and B2B SaaS companies, the
// gauntlet list (docs/gauntlet-log.md, "Hiring signal") first. A company is
// listed on one system only, so a company on two boards isn't counted twice.
export const BOARDS = [
  // The gauntlet list.
  ["greenhouse", "anthropic", "Anthropic"],
  ["ashby", "openai", "OpenAI"],
  ["ashby", "ramp", "Ramp"],
  ["ashby", "notion", "Notion"],
  ["ashby", "harvey", "Harvey"],
  ["ashby", "sierra", "Sierra"],
  ["ashby", "decagon", "Decagon"],
  ["greenhouse", "vercel", "Vercel"],
  // AI-forward.
  ["ashby", "cohere", "Cohere"],
  ["ashby", "perplexity", "Perplexity"],
  ["ashby", "cursor", "Cursor"],
  ["ashby", "cognition", "Cognition"],
  ["ashby", "factory", "Factory"],
  ["ashby", "replit", "Replit"],
  ["ashby", "lovable", "Lovable"],
  ["ashby", "elevenlabs", "ElevenLabs"],
  ["ashby", "baseten", "Baseten"],
  ["ashby", "modal", "Modal"],
  ["ashby", "fireworks", "Fireworks AI"],
  ["ashby", "langchain", "LangChain"],
  ["ashby", "rogo", "Rogo"],
  ["ashby", "abridge", "Abridge"],
  ["ashby", "deepgram", "Deepgram"],
  ["ashby", "mercor", "Mercor"],
  ["ashby", "granola", "Granola"],
  ["ashby", "synthesia", "Synthesia"],
  ["greenhouse", "databricks", "Databricks"],
  ["greenhouse", "scaleai", "Scale AI"],
  ["greenhouse", "togetherai", "Together AI"],
  ["greenhouse", "gleanwork", "Glean"],
  ["greenhouse", "xai", "xAI"],
  ["greenhouse", "snorkelai", "Snorkel AI"],
  ["greenhouse", "cresta", "Cresta"],
  ["greenhouse", "assemblyai", "AssemblyAI"],
  ["greenhouse", "parloa", "Parloa"],
  ["greenhouse", "otter", "Otter.ai"],
  ["lever", "palantir", "Palantir"],
  // B2B SaaS and infrastructure.
  ["greenhouse", "stripe", "Stripe"],
  ["greenhouse", "figma", "Figma"],
  ["greenhouse", "gitlab", "GitLab"],
  ["greenhouse", "datadog", "Datadog"],
  ["greenhouse", "mongodb", "MongoDB"],
  ["greenhouse", "elastic", "Elastic"],
  ["greenhouse", "okta", "Okta"],
  ["greenhouse", "twilio", "Twilio"],
  ["greenhouse", "asana", "Asana"],
  ["greenhouse", "gusto", "Gusto"],
  ["greenhouse", "brex", "Brex"],
  ["greenhouse", "samsara", "Samsara"],
  ["greenhouse", "cloudflare", "Cloudflare"],
  ["greenhouse", "dropbox", "Dropbox"],
  ["greenhouse", "intercom", "Intercom"],
  ["greenhouse", "mixpanel", "Mixpanel"],
  ["greenhouse", "braze", "Braze"],
  ["greenhouse", "launchdarkly", "LaunchDarkly"],
  ["greenhouse", "pagerduty", "PagerDuty"],
  ["greenhouse", "gongio", "Gong"],
  ["greenhouse", "zoominfo", "ZoomInfo"],
  ["greenhouse", "apolloio", "Apollo.io"],
  ["greenhouse", "attentive", "Attentive"],
  ["greenhouse", "klaviyo", "Klaviyo"],
  ["greenhouse", "toast", "Toast"],
  ["greenhouse", "fivetran", "Fivetran"],
  ["greenhouse", "grafanalabs", "Grafana Labs"],
  ["greenhouse", "smartsheet", "Smartsheet"],
  ["greenhouse", "sigmacomputing", "Sigma Computing"],
  ["greenhouse", "salesloft", "Salesloft"],
  ["greenhouse", "6sense", "6sense"],
  ["greenhouse", "qualtrics", "Qualtrics"],
  ["greenhouse", "cockroachlabs", "Cockroach Labs"],
  ["greenhouse", "wizinc", "Wiz"],
  ["greenhouse", "greenhouse", "Greenhouse"],
  ["greenhouse", "workato", "Workato"],
  ["greenhouse", "sumologic", "Sumo Logic"],
  ["greenhouse", "newrelic", "New Relic"],
  ["greenhouse", "checkr", "Checkr"],
  ["greenhouse", "faire", "Faire"],
  ["greenhouse", "tripactions", "Navan"],
  ["greenhouse", "zuora", "Zuora"],
  ["greenhouse", "anaplan", "Anaplan"],
  ["greenhouse", "billcom", "BILL"],
  ["greenhouse", "justworks", "Justworks"],
  ["greenhouse", "customerio", "Customer.io"],
  ["greenhouse", "adyen", "Adyen"],
  ["greenhouse", "rubrik", "Rubrik"],
  ["greenhouse", "netskope", "Netskope"],
  ["greenhouse", "zscaler", "Zscaler"],
  ["greenhouse", "tanium", "Tanium"],
  ["greenhouse", "cribl", "Cribl"],
  ["ashby", "linear", "Linear"],
  ["ashby", "hex", "Hex"],
  ["ashby", "supabase", "Supabase"],
  ["ashby", "vanta", "Vanta"],
  ["ashby", "drata", "Drata"],
  ["ashby", "zapier", "Zapier"],
  ["ashby", "warp", "Warp"],
  ["ashby", "zip", "Zip"],
  ["ashby", "watershed", "Watershed"],
  ["ashby", "benchling", "Benchling"],
  ["ashby", "snyk", "Snyk"],
  ["ashby", "1password", "1Password"],
  ["ashby", "plaid", "Plaid"],
  ["ashby", "gainsight", "Gainsight"],
  ["ashby", "clickup", "ClickUp"],
  ["ashby", "claylabs", "Clay"],
  ["ashby", "omni", "Omni"],
  ["ashby", "moderntreasury", "Modern Treasury"],
  ["ashby", "airwallex", "Airwallex"],
  ["ashby", "multiverse", "Multiverse"],
  ["ashby", "oyster", "Oyster"],
  ["ashby", "gorgias", "Gorgias"],
  ["ashby", "handshake", "Handshake"],
  ["ashby", "render", "Render"],
  ["ashby", "temporal", "Temporal"],
  ["ashby", "clickhouse", "ClickHouse"],
  ["ashby", "webflow", "Webflow"],
  ["ashby", "rillet", "Rillet"],
  ["ashby", "campfire", "Campfire"],
  ["ashby", "tabs", "Tabs"],
  ["ashby", "ashby", "Ashby"],
  ["ashby", "paddle", "Paddle"],
  ["ashby", "amplitude", "Amplitude"],
  ["ashby", "sentry", "Sentry"],
  ["lever", "outreach", "Outreach"],
  ["lever", "jumpcloud", "JumpCloud"],
];

// --- args ---------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const OUT = resolve(ROOT, flag("out", "evals/postings/corpus.jsonl"));
const DELAY_MS = Number(flag("delay", "750"));
const PER_COMPANY = Number(flag("per-company", "9"));
const CACHE = flag("cache", null);
const ONLY = flag("boards", null)?.split(",").map((s) => s.trim());
// Control shares of the finished corpus (docs/fit-check-at-scale.md).
const MISMATCH_SHARE = 0.1;
const NEAR_MISS_SHARE = 0.05;
// Above this the corpus is written gzipped, so the repo doesn't carry a
// multi-megabyte text file.
const GZIP_ABOVE_BYTES = 3 * 1024 * 1024;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- fetching -----------------------------------------------------------------

function boardUrl(source, token) {
  if (source === "greenhouse") {
    return `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true&pay_transparency=true`;
  }
  if (source === "ashby") {
    return `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=true`;
  }
  if (source === "lever") return `https://api.lever.co/v0/postings/${token}?mode=json`;
  throw new Error(`unknown source ${source}`);
}

async function getJson(url, cacheKey) {
  if (CACHE) {
    const file = join(CACHE, `${cacheKey}.json`);
    // A cached board keeps the time it was really fetched.
    if (existsSync(file)) {
      return { json: JSON.parse(readFileSync(file, "utf8")), cached: true, fetchedAt: statSync(file).mtime.toISOString() };
    }
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "application/json" },
        signal: controller.signal,
      });
      if ((res.status === 429 || res.status >= 500) && attempt === 0) {
        await sleep(5000);
        continue;
      }
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const json = await res.json();
      if (CACHE) {
        mkdirSync(CACHE, { recursive: true });
        writeFileSync(join(CACHE, `${cacheKey}.json`), JSON.stringify(json));
      }
      return { json, cached: false };
    } catch (err) {
      if (attempt === 0) {
        await sleep(5000);
        continue;
      }
      return { error: err.name === "AbortError" ? "timeout" : err.message };
    } finally {
      clearTimeout(timer);
    }
  }
  return { error: "retries exhausted" };
}

// --- normalizing one board's jobs ----------------------------------------------

function money(n) {
  return Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : null;
}

function greenhouseJobs(json, token, company, fetchedAt) {
  return (json.jobs ?? [])
    .filter((j) => !j.language || j.language === "en")
    .map((j) => {
      const range = (j.pay_input_ranges ?? [])[0];
      const compensation = range
        ? `${range.currency_type ?? ""} ${money(range.min_cents / 100)}–${money(range.max_cents / 100)}`.trim()
        : null;
      return {
        id: `greenhouse:${token}:${j.id}`,
        company,
        title: String(j.title ?? "").trim(),
        url: j.absolute_url,
        source: "greenhouse",
        board: token,
        fetchedAt,
        publishedAt: j.first_published ?? j.updated_at ?? null,
        location: j.location?.name ?? null,
        compensation,
        html: j.content ?? "",
      };
    });
}

function ashbyJobs(json, token, company, fetchedAt) {
  return (json.jobs ?? [])
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const c = j.compensation ?? null;
      const shown = j.shouldDisplayCompensationOnJobPostings !== false;
      const compensation = shown
        ? c?.scrapeableCompensationSalarySummary || c?.compensationTierSummary || null
        : null;
      const locations = [j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)].filter(Boolean);
      return {
        id: `ashby:${token}:${j.id}`,
        company,
        title: String(j.title ?? "").trim(),
        url: j.jobUrl,
        source: "ashby",
        board: token,
        fetchedAt,
        publishedAt: j.publishedAt ?? null,
        location: locations.join("; ") || null,
        compensation,
        html: j.descriptionHtml ?? "",
      };
    });
}

function leverJobs(json, token, company, fetchedAt) {
  return (Array.isArray(json) ? json : []).map((j) => {
    // The hosted page shows the description, then each list under its
    // heading, then the closing section and the pay statement.
    const lists = (j.lists ?? []).map((l) => `<h3>${l.text ?? ""}</h3><ul>${l.content ?? ""}</ul>`).join("");
    const html = `${j.description ?? ""}${lists}${j.additional ?? ""}${j.salaryDescription ?? ""}`;
    const r = j.salaryRange;
    const compensation =
      r && Number.isFinite(r.min) && Number.isFinite(r.max)
        ? `${r.currency ?? ""} ${money(r.min)}–${money(r.max)}${r.interval ? ` (${r.interval})` : ""}`.trim()
        : null;
    return {
      id: `lever:${token}:${j.id}`,
      company,
      title: String(j.text ?? "").trim(),
      url: j.hostedUrl,
      source: "lever",
      board: token,
      fetchedAt,
      publishedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      location: j.categories?.allLocations?.join("; ") || j.categories?.location || null,
      compensation,
      html,
    };
  });
}

// --- run ------------------------------------------------------------------------

async function main() {
  const boards = ONLY
    ? BOARDS.filter(([s, t]) => ONLY.includes(`${s}:${t}`) || ONLY.includes(t))
    : BOARDS;
  console.log(`\nFetching ${boards.length} board(s), ${DELAY_MS} ms apart${CACHE ? `, cache ${CACHE}` : ""}\n`);

  const labelled = [];
  const boardStats = [];
  let first = true;
  for (const [source, token, company] of boards) {
    if (!first && !(CACHE && existsSync(join(CACHE, `${source}-${token}.json`)))) await sleep(DELAY_MS);
    first = false;
    const requestedAt = new Date().toISOString();
    const { json, error, cached, fetchedAt: cachedAt } = await getJson(boardUrl(source, token), `${source}-${token}`);
    const fetchedAt = cachedAt ?? requestedAt;
    if (error) {
      console.log(`  ${source}:${token} — ${error}`);
      boardStats.push({ source, token, company, error });
      continue;
    }
    const jobs =
      source === "greenhouse"
        ? greenhouseJobs(json, token, company, fetchedAt)
        : source === "ashby"
          ? ashbyJobs(json, token, company, fetchedAt)
          : leverJobs(json, token, company, fetchedAt);

    let kept = 0;
    for (const job of jobs) {
      const text = htmlToText(job.html);
      const label = classifyPosting(job.title, text);
      if (!label) continue;
      if (text.length < MIN_POSTING_CHARS) continue;
      const fromText = job.compensation ? null : compensationFromText(text);
      const { html, ...rest } = job;
      void html;
      labelled.push({
        ...rest,
        compensation: job.compensation ?? fromText?.text ?? null,
        compensationSource: job.compensation ? "board" : fromText ? "text" : null,
        family: label.family,
        control: label.control,
        controlKind: label.control === "none" ? null : label.kind,
        text,
      });
      kept += 1;
    }
    boardStats.push({ source, token, company, jobs: jobs.length, labelled: kept });
    console.log(`  ${source}:${token}${cached ? " (cached)" : ""} — ${jobs.length} jobs, ${kept} labelled`);
  }

  // Sort for a deterministic dedupe: the first copy of a role kept is the one
  // with the lowest id.
  labelled.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const { kept: unique, dropped } = dedupePostings(labelled);

  // In-family postings, capped per company so one large board can't stand in
  // for the market. Which ones survive the cap is decided by a hash of the id,
  // not by board order.
  const inFamily = unique.filter((p) => p.control === "none");
  const perCompany = new Map();
  const family = [];
  for (const p of [...inFamily].sort((a, b) => hash32(a.id) - hash32(b.id))) {
    const n = perCompany.get(p.company) ?? 0;
    if (n >= PER_COMPANY) continue;
    perCompany.set(p.company, n + 1);
    family.push(p);
  }

  // Controls, sized as shares of the finished corpus and spread across kinds
  // and companies.
  const total = Math.round(family.length / (1 - MISMATCH_SHARE - NEAR_MISS_SHARE));
  const pick = (pool, n) => {
    const byKind = new Map();
    for (const p of [...pool].sort((a, b) => hash32(a.id) - hash32(b.id))) {
      const list = byKind.get(p.controlKind) ?? [];
      list.push(p);
      byKind.set(p.controlKind, list);
    }
    // Round-robin across kinds, and within a kind prefer a company not yet used.
    const chosen = [];
    const usedCompanies = new Set();
    const queues = [...byKind.values()];
    while (chosen.length < n && queues.some((q) => q.length)) {
      for (const q of queues) {
        if (chosen.length >= n || !q.length) continue;
        let idx = q.findIndex((p) => !usedCompanies.has(`${p.controlKind}|${p.company}`));
        if (idx === -1) idx = 0;
        const [p] = q.splice(idx, 1);
        usedCompanies.add(`${p.controlKind}|${p.company}`);
        chosen.push(p);
      }
    }
    return chosen;
  };
  const mismatches = pick(unique.filter((p) => p.control === "mismatch"), Math.round(total * MISMATCH_SHARE));
  const nearMisses = pick(unique.filter((p) => p.control === "near-miss"), Math.round(total * NEAR_MISS_SHARE));

  const order = (p) => (p.control === "none" ? FAMILIES.indexOf(p.family) : FAMILIES.length + CONTROLS.indexOf(p.control));
  const corpus = [...family, ...nearMisses, ...mismatches]
    .map((p) => {
      const facts = lengthFacts(p.text);
      return {
        id: p.id,
        company: p.company,
        title: p.title,
        url: p.url,
        source: p.source,
        fetchedAt: p.fetchedAt,
        publishedAt: p.publishedAt,
        location: p.location,
        compensation: p.compensation,
        compensationSource: p.compensationSource,
        family: p.family,
        control: p.control,
        controlKind: p.controlKind,
        ...facts,
        text: p.text,
      };
    })
    .sort((a, b) => order(a) - order(b) || a.company.localeCompare(b.company) || a.title.localeCompare(b.title) || (a.id < b.id ? -1 : 1));

  const body = corpus.map((p) => JSON.stringify(p)).join("\n") + "\n";
  mkdirSync(dirname(OUT), { recursive: true });
  let target = OUT;
  if (Buffer.byteLength(body) > GZIP_ABOVE_BYTES) {
    target = OUT.endsWith(".gz") ? OUT : `${OUT}.gz`;
    writeFileSync(target, gzipSync(body, { level: 9 }));
  } else {
    writeFileSync(target, body);
  }

  // --- summary --------------------------------------------------------------
  const count = (pred) => corpus.filter(pred).length;
  console.log(`\n${"═".repeat(60)}`);
  console.log(`Boards: ${boardStats.filter((b) => !b.error).length} fetched, ${boardStats.filter((b) => b.error).length} failed`);
  console.log(`Labelled ${labelled.length}, duplicates dropped ${dropped}, in-family ${inFamily.length} (capped to ${family.length} at ${PER_COMPANY}/company)`);
  console.log(`Corpus: ${corpus.length} postings from ${new Set(corpus.map((p) => p.company)).size} companies`);
  for (const f of FAMILIES) console.log(`  ${f.padEnd(24)} ${count((p) => p.family === f && p.control === "none")}`);
  console.log(`  ${"near-miss".padEnd(24)} ${count((p) => p.control === "near-miss")}`);
  console.log(`  ${"mismatch".padEnd(24)} ${count((p) => p.control === "mismatch")}`);
  const cut = count((p) => p.cutBySite);
  console.log(`\nCut off by the paste panel: ${cut}/${corpus.length} (${((cut / corpus.length) * 100).toFixed(0)}%)`);
  console.log(`Wrote ${target} (${(Buffer.byteLength(body) / 1024).toFixed(0)} KB uncompressed)\n`);
}

main().catch((err) => {
  console.error(`\nfetch-postings failed: ${err.stack ?? err.message}`);
  process.exit(1);
});
