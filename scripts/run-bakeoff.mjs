// Runs the whole live corpus against every allowlisted model, one after the
// other, and publishes each run into the archive (Sprint 8).
//
// This is the thing that produces `/measurements/models`. It is deliberately a
// script you run by hand: it costs real tokens against a real API key, and the
// comparison it produces is a dated artifact rather than a live dashboard.
//
// Requires:
//   1. A running server with AI_GATEWAY_API_KEY set
//   2. `--ip <prefix>`, passed through to the runner, so a 22-case corpus is
//      not cut off by a 20-per-hour budget. See the note in run-live.mjs about
//      what that means: the run measures the models, not the rate limiter.
//
// Usage:
//   node scripts/run-bakeoff.mjs --base http://localhost:3007 --ip bakeoff-1
//   node scripts/run-bakeoff.mjs --models openai/gpt-5-mini --dry-run
//
// Each model's run is published as it completes, so an interrupted bake-off
// leaves every finished model on the record rather than nothing.

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Must stay in step with the `MODELS` allowlist in app/api/chat/route.ts. The
// static suite asserts the client's list matches the server's; this list is the
// third one, and the bake-off page says which models it covers, so a model
// missing here shows up as a model missing from the comparison rather than as a
// silent gap.
const ALL_MODELS = [
  "anthropic/claude-haiku-4.5",
  "openai/gpt-5-mini",
  "google/gemini-3.5-flash-lite",
  "deepseek/deepseek-v4-flash",
  "openai/gpt-5.6-luna",
];

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = flag("base", "http://localhost:3000");
const IP = flag("ip", null);
const DELAY = flag("delay", "600");
const DRY = args.includes("--dry-run");
const models = flag("models", null)?.split(",").map((m) => m.trim()) ?? ALL_MODELS;

if (!IP) {
  console.error(
    "Refusing to run without --ip. The corpus is 22 cases against a 20/hour budget,\n" +
      "so a bake-off without a bucket prefix stops two cases short on every model and\n" +
      "publishes five truncated runs. Pass --ip <prefix>.",
  );
  process.exit(1);
}

const run = (cmd, cmdArgs) =>
  spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: "inherit", env: process.env });

console.log(`\nBake-off — ${models.length} model(s) against ${BASE}\n`);

const done = [];
const rejected = [];
for (const model of models) {
  console.log(`\n${"█".repeat(60)}\n  ${model}\n${"█".repeat(60)}`);
  if (DRY) {
    console.log("  (dry run — not calling the model)");
    continue;
  }

  // The runner exits non-zero when any case fails, which is normal and not a
  // reason to stop the bake-off: a model that fails cases is a result.
  run("node", [
    "--experimental-strip-types",
    "--disable-warning=ExperimentalWarning",
    "evals/run-live.mjs",
    "--base", BASE,
    "--model", model,
    "--ip", `${IP}-${model.replace(/[^a-z0-9]+/gi, "-")}`,
    "--delay", DELAY,
  ]);

  const published = run("node", [
    "--experimental-strip-types",
    "--disable-warning=ExperimentalWarning",
    "scripts/publish-evals.mjs",
  ]);
  // 2 means the publisher refused the run because nothing in it was measured —
  // the shape of a server that went away mid-bake-off. Keep going, but do not
  // count it, and say so at the end rather than reporting five runs when four
  // landed.
  if (published.status === 2) {
    console.error(`\n  ! ${model} was not archived — nothing in that run was measured.`);
    rejected.push(model);
    continue;
  }
  if (published.status !== 0) {
    console.error(`\n  ! publishing ${model} failed — stopping so the archive stays consistent.`);
    process.exit(1);
  }
  done.push(model);
}

console.log(`\n${"═".repeat(60)}`);
console.log(`Published ${done.length} run(s): ${done.join(", ") || "none"}`);
if (rejected.length) {
  console.log(`NOT published (nothing measured): ${rejected.join(", ")}`);
  console.log("Re-run those models against a server that stays up.");
}
console.log("evals/published/latest.json is the artifact. Commit it.\n");
