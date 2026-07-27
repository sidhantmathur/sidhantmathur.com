// Builds the aggregate the /measurements page renders (roadmap Sprint 6).
//
// Two sources, both allowed to be missing:
//
//   1. evals/published/latest.json — the committed eval snapshot (#2, #22).
//   2. PostHog, queried over HTTP at BUILD TIME (#23).
//
// THE RULE THIS FILE EXISTS TO ENFORCE: a build with no credentials, no network,
// or no data still succeeds, and what it writes says plainly that there is
// nothing to show. It never falls back to a placeholder number, a sample figure,
// or a last-known value. On a site whose whole argument is that its instruments
// are honest, a panel that invents plausible numbers when its source is empty is
// the worst available outcome — so the empty path is the DEFAULT path here, and
// every failure funnels into it with a reason attached rather than throwing.
//
// The page stays static because this runs once, at build. Nothing is fetched per
// visit, and the numbers are exactly as fresh as the last deploy — which is why
// the generated data carries `builtAt` and the page prints it.
//
// Credentials (all optional, server-side only — never NEXT_PUBLIC):
//   POSTHOG_PROJECT_ID          numeric project id
//   POSTHOG_PERSONAL_API_KEY    personal API key with query scope
//   POSTHOG_HOST                defaults to https://us.posthog.com
//
// Wired as prebuild/predev alongside scripts/build-knowledge.mjs.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT = join(ROOT, "evals", "published", "latest.json");
// Overridable so evals/measurements.test.mjs can run this for real — with the
// credentials stripped — and read what it wrote, without clobbering the module
// the running build depends on. The empty state is the one path that must be
// exercised end to end rather than asserted about from a distance.
const OUT = process.env.MEASUREMENTS_OUT
  ? join(ROOT, process.env.MEASUREMENTS_OUT)
  : join(ROOT, "lib", "measurements.generated.ts");

/** How far back the analytics aggregate looks. Printed on the page. */
const WINDOW_DAYS = 90;
/** Give up rather than hold a build hostage to a slow query. */
const QUERY_TIMEOUT_MS = 15_000;

// --- the eval snapshot ------------------------------------------------------

function readSnapshot() {
  if (!existsSync(SNAPSHOT)) return null;
  try {
    const parsed = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
    // A snapshot with neither half is the same as no snapshot.
    if (!parsed?.static && !parsed?.live?.runs?.length) return null;
    return parsed;
  } catch (err) {
    console.warn(`  ! evals/published/latest.json is unreadable (${err.message}) — publishing nothing.`);
    return null;
  }
}

// --- PostHog ----------------------------------------------------------------

const COMPLETE_QUERY = `
  select
    properties.model as model,
    count() as turns,
    quantile(0.5)(toFloat(properties.ttft_ms)) as p50,
    quantile(0.95)(toFloat(properties.ttft_ms)) as p95,
    countIf(properties.cache_hit = true) as cache_hits,
    countIf(isNotNull(properties.cache_hit)) as cache_reported
  from events
  where event = 'chat_turn_complete'
    and timestamp > now() - interval ${WINDOW_DAYS} day
  group by model
  order by turns desc
`;

const FAILED_QUERY = `
  select properties.error_class as error_class, count() as n
  from events
  where event = 'chat_turn_failed'
    and timestamp > now() - interval ${WINDOW_DAYS} day
  group by error_class
  order by n desc
`;

async function runQuery(host, projectId, key, query) {
  const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 160)}`);
  }
  const body = await res.json();
  return Array.isArray(body?.results) ? body.results : [];
}

/** Never throws. Every exit returns a shape the page can render. */
async function buildAnalytics() {
  const host = (process.env.POSTHOG_HOST ?? "https://us.posthog.com").replace(/\/$/, "");
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const key = process.env.POSTHOG_PERSONAL_API_KEY;

  if (!projectId || !key) {
    console.log("  · no PostHog build credentials — the reliability panel will say so.");
    return { available: false, reason: "no-credentials", detail: null };
  }

  try {
    const [completed, failed] = await Promise.all([
      runQuery(host, projectId, key, COMPLETE_QUERY),
      runQuery(host, projectId, key, FAILED_QUERY),
    ]);

    const models = completed
      .map(([model, turns, p50, p95, cacheHits, cacheReported]) => ({
        model: typeof model === "string" && model ? model : "unknown",
        turns: Number(turns) || 0,
        p50Ms: finite(p50),
        p95Ms: finite(p95),
        cacheHitRate: Number(cacheReported) > 0 ? Number(cacheHits) / Number(cacheReported) : null,
      }))
      .filter((m) => m.turns > 0);

    const byClass = failed
      .map(([cls, n]) => ({ class: typeof cls === "string" && cls ? cls : "unknown", count: Number(n) || 0 }))
      .filter((c) => c.count > 0);

    const completedTurns = models.reduce((n, m) => n + m.turns, 0);
    const failedTurns = byClass.reduce((n, c) => n + c.count, 0);

    if (completedTurns + failedTurns === 0) {
      console.log("  · PostHog answered, but no chat turns in the window — the panel will say so.");
      return { available: false, reason: "no-events", detail: null };
    }

    console.log(`  · ${completedTurns} completed and ${failedTurns} failed turn(s) in ${WINDOW_DAYS} days.`);
    return {
      available: true,
      windowDays: WINDOW_DAYS,
      completedTurns,
      failedTurns,
      models,
      byClass,
    };
  } catch (err) {
    // A network blip, an expired key, a schema change: all of them mean the same
    // thing to a reader, which is that this build could not measure anything.
    const detail = err?.name === "TimeoutError" ? "the query timed out" : String(err?.message ?? err).slice(0, 200);
    console.warn(`  ! PostHog query failed (${detail}) — the panel will say so. Build continues.`);
    return { available: false, reason: "query-failed", detail };
  }
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// --- write ------------------------------------------------------------------

const HEADER = `// GENERATED by scripts/build-measurements.mjs — do not edit.
//
// Two build-time aggregates for /measurements: the committed eval snapshot
// (evals/published/latest.json) and, when the build had credentials, the
// PostHog turn history. Either may be absent; the page renders an empty state
// naming what is missing rather than a number nobody measured.
//
// Types live in lib/measurement-types.ts so this file's failure path only has
// to produce the same three constants, not the same declarations.

import type { Analytics, PublishedEvals } from "./measurement-types";
`;

/** Both exit paths write exactly this, so both stay type-compatible. */
function render(evals, analytics) {
  return `${HEADER}
/** When this build ran. The page prints it — the numbers are this old. */
export const BUILT_AT = ${JSON.stringify(new Date().toISOString())};

/** The committed eval snapshot, or null if none has been published. */
export const PUBLISHED_EVALS: PublishedEvals | null = ${JSON.stringify(evals, null, 2)};

/** The PostHog aggregate, or the reason there isn't one. */
export const ANALYTICS: Analytics = ${JSON.stringify(analytics, null, 2)};
`;
}

async function main() {
  console.log("Building measurements…");
  const evals = readSnapshot();
  if (evals) {
    console.log(`  · eval snapshot published ${evals.publishedAt ?? "at an unknown time"}.`);
  } else {
    console.log("  · no published eval snapshot — that section will say so.");
  }
  const analytics = await buildAnalytics();

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, render(evals, analytics), "utf8");

  console.log(`  → lib/measurements.generated.ts`);
}

main().catch((err) => {
  // Belt and braces: nothing above should throw, and if something does, the
  // build still has to produce a file. An unwritten module is a build failure,
  // which is the one outcome this script is not allowed to cause.
  console.warn(`Measurements build hit an unexpected error (${err?.message ?? err}). Writing the empty state.`);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    render(null, {
      available: false,
      reason: "query-failed",
      detail: String(err?.message ?? err).slice(0, 200),
    }),
    "utf8",
  );
  process.exit(0);
});
