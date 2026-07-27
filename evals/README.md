# Evals

A test harness for the chat assistant. Two layers, deliberately separated by
what they cost to run.

| | Layer 1 — static | Layer 2 — live |
| --- | --- | --- |
| Command | `npm run eval` | `npm run eval:live` |
| Needs an API key | no | yes |
| Needs a running server | no | yes |
| Token cost | zero | one turn per case |
| Safe in CI | yes | not on every push |

No new dependencies. Layer 1 runs on Node's built-in test runner, with
`--experimental-strip-types` so `lib/transcript.ts` can be tested directly
without a build step.

## Layer 1 — static (`npm run eval`)

Deterministic checks over the build artifacts and source. These are the
invariants the chat silently depends on:

- **Knowledge base** — built, non-empty, all six source files present, within
  the ~8k token target, no `[TODO]` markers.
- **Chunk index** — every chunk of `content/knowledge` is addressable, ids are
  unique and shaped `<source>:<slug>`, every chunk carries content, the ids
  `shell-data.ts` hardcodes still exist, and the ids the panel can open and the
  ids the prompt shows the model are the same set in both directions.
- **Citation checking** (`lib/verify.ts`) — the downgrade path, which is the
  Sprint 3 acceptance criterion: a claim citing a chunk that doesn't contain its
  number, a claim citing an id that doesn't exist, and a claim citing nothing
  are each downgraded by code. Plus the calibration cases — every false
  "unverified" a live run produced is pinned as a test, because a checker that
  cries wolf stops being read.
- **System prompt** — every guard section present (`Scope`, `Untrusted input`,
  `Formatting`, `Knowledge base`, `Citing`, `Tools`), the specific injection defenses
  intact, every tool the route defines is documented in the prompt, and nothing
  dynamic crept in that would break prompt caching.
- **Model allowlist** — every model the client offers exists on the server
  allowlist. This is the footgun `docs/followups.md` §2 flags: a mismatch
  silently falls back to the default model rather than erroring, so it is
  invisible in the UI. This check is how it becomes visible.
- **Fixture freshness** — every fact the live cases assert on actually appears
  in the knowledge base, and the "not qualified" job postings really are ones
  the corpus doesn't cover.
- **Transcript serializer** — unit tests for `lib/transcript.ts`.

The **fixture freshness** group is what keeps the suite honest. A live case checking for
`1,400` is worthless once someone edits `resume.md` and the number changes — the
case would fail and look like a model regression. Layer 1 catches it as what it
is: a stale assertion.

`npm run eval` prints TAP **and** writes `evals/static-results.json` — the same
run, machine-readable, one record per assertion with the suite it sits under.
That file is git-ignored; it is an input to publishing, not the artifact.

## Publishing a run (`npm run eval:publish`)

The site's `/measurements` page publishes `evals/published/latest.json`, which is
**committed**. It never publishes whatever happened to run on the build machine:
a deploy with no API key still builds, and the page can still say when its
numbers were measured, because measuring and publishing are two events with two
timestamps.

```bash
npm run eval && npm run eval:publish          # publish the static suite
npm run eval:live -- --group grounded
npm run eval:publish                          # merge that run in as well
```

Live runs **archive**. Every published run is kept, keyed by model *and* the time
it was measured, because a full corpus costs more than one hour of rate limit and
the models get measured on different days. Publishing a second run on a model
adds it; nothing is replaced. Re-publishing the *same* run is idempotent. The
static half is replaced wholesale — there is only ever one suite.

Until Sprint 8 a run replaced its model's previous entry outright, which meant a
second measurement destroyed the first: a regression was invisible, and a figure
measured twice looked exactly like one measured once. `/measurements` and
`/measurements/models` read the most recent run per model and list the rest.

A run in which **nothing was measured is refused**, and the publisher exits `2`.
That is the shape of a server that went away mid-run — every case a
`fetch failed` — and it would otherwise be archived as a model scoring zero.

## The bake-off (`node scripts/run-bakeoff.mjs`)

Runs the whole corpus against every allowlisted model, one after another, and
publishes each run as it finishes — so an interrupted bake-off leaves every
completed model on the record. This is what produces `/measurements/models`.

```bash
npm run dev                                                  # with AI_GATEWAY_API_KEY set
node scripts/run-bakeoff.mjs --base http://localhost:3000 --ip bakeoff-1
```

`--ip` is required and is a rate-limit bucket **prefix**: the runner sends a
distinct `x-forwarded-for` per case, so a 22-case corpus is not cut off by a
20-per-hour budget and five models are five full runs rather than one visitor's
budget split five ways. Say what that costs: **a run with `--ip` set is not
shaped by the rate limiter**, so it measures the models and says nothing about
the budget. The limiter is asserted in the static suite instead. It is a plain
request header, so it only does anything against a server that trusts it —
localhost does; the deployed site, behind Vercel's proxy, does not.

Each run publishes a **performance record** as well as verdicts: time to first
token, duration, output tokens/sec, input, cached input and output tokens, steps,
finish reason, and cost computed by `lib/pricing.ts` at list price. A missing
measurement is published as `null` and never as `0` — a turn with no telemetry
averaged in as 0 ms would make a broken run look like the fastest model on the
page.

What does **not** travel into the snapshot: the assistant's prose. Every answer
in a live run is unreviewed model output making claims about Sidhant, and the
copy rule in `CLAUDE.md` has no exception for text that arrived in a JSON file.
Verdicts, counts and the citation summary are measurements about the run, not
claims about him, so those do. There is a test.

## Layer 2 — live (`npm run eval:live`)

Runs the corpus against a **real running server** over HTTP, so it measures the
actual system — real prompt, real tools, real allowlist, real rate limiter. A
harness that rebuilt the prompt itself would drift from production and start
grading a fiction.

```bash
npm run dev                              # in one terminal, with AI_GATEWAY_API_KEY set
npm run eval:live -- --group roleFit     # in another
```

Options: `--group <name>`, `--model <id>`, `--base <url>`, `--delay <ms>`,
`--ip <prefix>` (see the bake-off section above for what that one costs).

Every answer is also run through `lib/verify.ts` and the result printed under
the case: how many chunks it cited, how many of its claims verified, and each
downgrade. **Reported, not scored** — same call as soft-pedal phrasing. A model
that cites badly is a prompt problem worth seeing, but failing the suite on it
would tempt whoever is on the hook into loosening the checker, and the checker
is the one thing here that must not be negotiable.

Results land in `evals/results.json` (git-ignored), and the process exits
non-zero on failure so it can gate CI later.

**Rate limit.** The standard tier allows 20 requests/hour per IP and the full
corpus is exactly 20 cases, so a full run sits right at the ceiling. Run one
group at a time. With no Upstash env vars the limiter falls back to an in-memory
store scoped to the server process, so restarting `npm run dev` resets the
budget. The runner detects a 429, stops cleanly, and says so rather than
reporting the remaining cases as failures.

### Groups

- **grounded** (6) — does it state facts that are actually in the corpus? Includes
  a hallucination canary: asking about salary expectations, which the corpus
  doesn't cover, must produce "I don't have that" rather than an invented range.
- **refusal** (4) — does it decline out-of-scope requests instead of helping?
- **injection** (6) — role override, prompt extraction, knowledge-base dump, a
  fake system message, disparagement bait, and persona hijack.
- **roleFit** (5) — the job-description cases. See below.

## The job-description cases

This is the Stage 0 corpus from `docs/idea-bank.md` §6, and it exists to answer
one question: **does the model name the gaps?**

The feature's premise is that unmet requirements go in `caveats`. That premise
is currently defended by two sentences of prompt and an **optional** schema field
whose description reads "Omit if there is nothing honest to say." Models are
sycophantic. These cases measure whether it holds.

Two of the five postings are roles Sidhant is genuinely **not** qualified for —
a senior ML infrastructure role and an engineering manager role. Those are the
important ones. A run where `revops-strong-fit` passes and `ml-infra-unqualified`
fails is the feature working exactly as badly as suspected, and that result is
the evidence for changing the schema.

Each case reports three things separately, because they fail independently and
the difference between them is the diagnosis:

1. **Was the gap named anywhere?** Did the model notice at all.
2. **Was it named in `caveats`?** Did it land where the feature promises it will.
   A gap mentioned only in passing prose won't survive being forwarded.
3. **Was it softened as it was named?** The subtle failure: an assessment that
   says "while he hasn't operated Kubernetes clusters, his infrastructure
   instincts are readily transferable" technically names the gap, passes a naive
   keyword check, and reads to a recruiter as *this doesn't matter*.

Soft-pedal phrasing is **reported, not failed** — some of it is legitimate in
context. The runner surfaces it so a human can judge, and the matched phrases
land in `results.json`.

## Adding a case

Add it to the right array in `cases.mjs`. Grounded cases also need their
expected facts to exist in the corpus or Layer 1 will fail them as stale —
that's intentional.

Assertions are deterministic string checks, not model grading. That keeps runs
free and reproducible; the trade-off is that they check for the presence of
specific evidence rather than judging overall quality. A wrong answer containing
the right number still passes. They are a regression net, not a quality score.
