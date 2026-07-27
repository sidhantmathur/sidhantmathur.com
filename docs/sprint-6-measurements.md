# Sprint 6 spec — publish the measurements

One page, written 2026-07-27 at the point of starting the sprint, per
`docs/roadmap.md` → "How the work gets specced". Intent and acceptance only; it
names no files or functions, because those move.

Covers **#2** (published eval suite), **#23** (latency and reliability panel)
and **#22** (groundedness self-report with calibration, gated on #2).

---

## Intent

Five sprints have built a site whose entire argument is that its instruments are
honest, and every one of those instruments is **local to one conversation**. The
cost meter shows what your turn cost. The citation marks show what your answer
cited. Nothing on the site says how often any of it works — and "the model cites
its sources" is a claim a reader has no way to size.

This sprint publishes the aggregate. Three numbers a visitor cannot get from
having a conversation: how the assistant scores against a fixed adversarial
corpus, how fast and how reliably it answers in the wild, and how often its
claims survive the site's own checker.

The failure mode is specific and worth naming up front. **A panel that invents
plausible numbers when its source is empty is worse than no panel**, because it
converts the site's one real asset — that its readouts are checkable — into a
liability. Every surface this sprint builds must have a correct, visible,
tested empty state, and must reach it by default rather than by exception.

## What ships

**#2 — the published eval suite.** `npm run eval` emits machine-readable output
alongside the TAP it already prints. A separate, deliberate step turns a run
into a **committed snapshot**, and the site renders that snapshot: how many
cases, in what groups, what they assert, what passed, on which models, when.
The snapshot is the published artifact — the site never publishes whatever
happened to run on the build machine.

**#23 — latency and reliability.** p50/p95 time-to-first-token by model, error
rate by class, and prompt-cache hit rate, aggregated at build time from the F3
analytics events Sprint 1 shipped early for exactly this. The page stays static.

**#22 — groundedness self-report.** How many checkable claims in the published
run cited a chunk that actually contained their numbers and names — plus the
calibration that makes the number readable: what `verified` narrowly means, how
the checker is measured against its own labelled corpus, and what it cannot see.

## Constraints

1. **Static-first.** Everything aggregates at build time. No new server route,
   no client-side query, nothing fetched per visit.
2. **The build passes with no credentials and no data.** A build machine with no
   analytics key, or a key pointing at a project that has never seen a turn, must
   produce a green build and a page that says it has nothing to show. This is the
   default path, not the error path, and it is the one with a test.
3. **Do not publish a number you cannot stand behind.** Sprint 2 kept an estimate
   and a measurement visually distinct rather than collapsing them; the same
   discipline applies here. A figure that is derived, a list price, or a small
   sample says so on the surface, next to itself — not in a footnote.
4. **A percentile needs a sample.** Below a stated threshold the surface reports
   the count and withholds the percentile, rather than computing one from four
   events and printing it in the same type as everything else.
5. **The source data gets checked before it gets published.** Sprint 2's finding
   3 flags the price table's derived cache figures as unverified and says so
   should happen before this sprint publishes any of it. That check is part of
   this sprint's work, and whatever it finds is recorded whether or not anything
   here depends on it.
6. **#22 is gated on #2 in the code, not just in the plan.** The groundedness
   number is read out of the published eval artifact. If there is no artifact,
   there is no number — which is the gate working.
7. **Nothing published upgrades its own claim.** `verified` means what
   `lib/verify.ts` establishes and no more (Sprint 3's finding 5).
8. **Copy rules** (CLAUDE.md): every drafted string logged, no invented facts
   about Sidhant.

## Done means

- `npm run eval` emits machine-readable results as well as TAP, and there is a
  documented way to turn a run into a committed, published snapshot.
- A pre-rendered page publishes the eval suite, the latency and reliability
  aggregate, and the groundedness self-report, each labelled with its source,
  its sample size, and its date.
- With no analytics credentials and no published snapshot, `npm run build`
  passes and every section renders an honest empty state naming what is missing.
  Both directions are asserted by static tests.
- No figure on the page is derived, estimated, or small-sample without saying so
  beside itself.
- `npm run build`, `npm run lint` and `npm run eval` clean, with the suite
  larger than the 157 it starts at and no existing assertion loosened.

## Out of scope, deliberately

- **Live analytics.** No per-visit query, no dashboard, no server route. The
  numbers are as fresh as the last deploy and the page says so.
- **Publishing dollars.** The cost arithmetic stays where Sprint 2 put it — in
  the per-conversation meter, where it is labelled an estimate at list price.
  Nothing this sprint publishes is denominated in money, so nothing here rests
  on the price table's soft numbers.
- **Publishing model output.** The snapshot carries verdicts, counts and
  telemetry, not the assistant's prose. Answers about Sidhant that no human
  reviewed are not copy this sprint ships.
- **Running the live suite in CI.** It costs tokens and needs a key; it stays a
  deliberate local step whose output is committed.
- **Scoring citations.** Sprint 3 reports them and does not fail on them, for the
  reason recorded there. Publishing the rate does not change that.
- **Sprint 7** — the system prompt (#7), the repo as a second corpus (#8), roast
  (#9), the refusal ledger (#10), manual mode (#15) — and all of Track B.
