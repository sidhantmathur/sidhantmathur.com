// A machine-readable reporter for the static suite (roadmap Sprint 6, #2).
//
// `npm run eval` printed TAP and nothing else, which is fine for a human and
// useless for anything that wants to publish what the suite covers. Node's test
// runner accepts several reporters at once, each with its own destination, so
// this runs alongside the TAP output rather than replacing it: humans keep the
// stream they had, and the JSON lands in a file.
//
// It emits one record per LEAF test — the assertions — plus the suite path each
// one sits under, because "what does this suite actually check" is the question
// the published page has to answer and a bare pass count doesn't.
//
// Ancestry is built from `test:start`, not from `test:pass`/`test:fail`: a suite
// completes after its children, so completion events arrive too late to tell a
// child what it was nested inside. `test:start` arrives in source order, so a
// stack indexed by nesting depth is exact.

/** @param {AsyncIterable<{type: string, data: any}>} source */
export default async function* jsonReporter(source) {
  /** Names of the currently-open suites, indexed by nesting depth. */
  const open = [];
  /** @type {{file: string, suite: string[], name: string, pass: boolean, durationMs: number}[]} */
  const tests = [];

  for await (const event of source) {
    const data = event.data ?? {};

    if (event.type === "test:start") {
      open[data.nesting ?? 0] = data.name;
      open.length = (data.nesting ?? 0) + 1;
      continue;
    }

    if (event.type !== "test:pass" && event.type !== "test:fail") continue;
    // Suites report their own pass/fail, which would double-count every leaf
    // underneath them.
    if (data.details?.type === "suite") continue;

    tests.push({
      file: relative(data.file),
      suite: open.slice(0, data.nesting ?? 0),
      name: data.name,
      pass: event.type === "test:pass",
      durationMs: round(data.details?.duration_ms),
    });
  }

  yield `${JSON.stringify(
    {
      // The run's own timestamp. Not the publish date — `scripts/publish-evals.mjs`
      // stamps that separately, because a run and a decision to publish it are
      // different events and collapsing them would let a stale snapshot look fresh.
      ranAt: new Date().toISOString(),
      totals: {
        tests: tests.length,
        passed: tests.filter((t) => t.pass).length,
        failed: tests.filter((t) => !t.pass).length,
      },
      tests,
    },
    null,
    2,
  )}\n`;
}

/** Absolute paths are the running machine's business, not the artifact's. */
function relative(file) {
  if (typeof file !== "string") return "";
  const at = file.lastIndexOf("/evals/");
  return at === -1 ? file : file.slice(at + 1);
}

function round(ms) {
  return typeof ms === "number" ? Math.round(ms * 1000) / 1000 : null;
}
