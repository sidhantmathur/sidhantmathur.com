# Consistent fit check

Written 2026-11-02, with the branch that built it
(`worktree-agent-a2567567248e90708`). Tested offline only: no request in this
work reached a model. The live check it still needs is at the end, with its
command and cost.

## The problem

When a visitor pastes a job posting, the chat extracts the requirements and
then fills a `roleFit` table with a verdict per row. That table is what a
recruiter forwards, and a second run on the same posting could say something
else. The record in `docs/followups.md` ("Reasoning on posting turns") shows
three runs of one posting at the default reasoning level with 7, 6 and 5
unmet rows. At `low`, the current setting, three runs came out 5, 5 and 4
unmet, and runs after the strengths-first prompt change came out at 6 or 7.
Either way, the verdict on a row can depend on which run you got.

## What ships

The posting is still extracted once, so the requirement list is fixed. It is
then assessed `CONSISTENCY_SAMPLES` times (3, in `lib/consistency.ts`),
independently and at the same time, and the table is the per-row consensus.

| Piece | Where |
| --- | --- |
| The constant, the merge, the vote readback, the cost helpers | `lib/consistency.ts` |
| Running the extra assessments | `lib/fit-samples.ts` |
| Wiring: start, wait, merge, cost | `app/api/chat/route.ts` |
| The row and table fields (`agreement`, `samples`, `unshared`) | `lib/role-fit.ts` |
| The turn record (`consistency`) and the progress part | `lib/chat-telemetry.ts` |
| The phase line's wait step | `lib/turn-phase.ts` |
| Rendering | `components/shell/panel-body.tsx`, `print-sheet.tsx`, `shell-data.ts` |
| One prompt sentence | `lib/system-prompt.ts` |

### Where the extra assessments start, and why there

The brief suggested starting them when the `roleFit` call arrives or inside
its `execute`. The code suggested a better seam. Started there, they would
run after the turn's own assessment instead of beside it, so the card would
wait for two assessments in a row: about 13 to 17 seconds, then another 10
or so.

They start in `prepareStep` instead, at the moment the judging step (step 1)
begins. `prepareStep` is handed the exact messages that step is about to send:
the system message with its cache-control option, the fenced posting, and the
extraction call and its result. So each extra assessment gets the same prompt
as the turn's own, without the route rebuilding it. Each one also gets the
same tools (with `execute` removed, so nothing runs), the same forced
`roleFit` choice, the same output ceiling (`MAX_OUTPUT_TOKENS_JD`), the same
reasoning level (`reasoningFor(model, { jobPosting: true })` from the
catalogue), and the request's abort signal. They use `generateText`, not
`streamText`, because nobody watches them stream.

`roleFit`'s `execute` then waits for them, so the card lands at about the time
of the slowest assessment, not the sum of them.

They only run on a posting with something extracted. A named-role question
("is he a fit for RevOps?") has no list to line them up against, so it runs
one assessment, exactly as before.

### How a row is settled

1. **Each assessment is reconciled on its own first**, by the existing
   `reconcileRoleFit`. So a vote is what that run would have shown alone. A
   `met` with no valid source votes `unclear`, and a requirement the run
   skipped votes `unclear` too.
2. **Rows are matched to the extraction by the posting's words**, then by a
   paraphrase in the same position, then by a paraphrase anywhere, one to one.
   The brief assumed rows align by index, and they usually do, but the code
   doesn't depend on it. A run that reorders or drops a row still lines up. A
   row matching nothing the posting asked never enters the table.
3. **A strict majority wins.** With no majority, or when one run says `met`
   and another `unmet`, the row is `unclear`, which is the verdict the
   reconciler already falls back to. A split row carries no evidence and no
   source, because no single run's sentence speaks for it.
4. **A source stays only if most of the runs behind the winning verdict cited
   it.** The minority's sources never count. The evidence sentence is the
   majority sentence that the kept sources hold up best, judged by the same
   check `lib/verify.ts` runs. On a tie it is the earliest one, which is the
   turn's own whenever that run is in the majority.
5. **The reconciler has the last word.** The merged rows go back through
   `reconcileRoleFit`, so citations are re-checked, uncited claims are
   downgraded, and gaps can't be empty while a row is unmet. A positive
   majority with no source in common is downgraded too, but it's labelled
   `unshared` rather than "cited no source", which would be false.
6. **The free text can't be voted on.** The `verdict` line, `gaps` and
   `noGapsRationale` come from the run that agrees with the consensus on the
   most rows (the turn's own on a tie). Any unmet row its gaps don't already
   name is added to them. Nothing is removed.

The verdicts don't depend on which extra run finished first. The same votes
always serialize the same way, so the same table always makes the same link.

### One assessment is today's table, exactly

`mergeRoleFitSamples([raw], extracted, lookup)` returns `reconcileRoleFit(raw,
extracted, lookup)` with the same keys in the same order (tested on six raw
shapes, garbage included). With `CONSISTENCY_SAMPLES = 1`, or on a named-role
question:

- no extra call is made
- no progress part is written
- the turn record has no `consistency` field
- the result has no `samples` field and no row has `agreement`
- what the model reads back is byte-identical to the SDK's default

### What the reader sees

Only rows where the runs disagreed change, and only by a short line in the
existing mono style:

- **A majority, not unanimous:** "2 of 3" under the verdict tag. It qualifies
  the verdict, and in the left column it can't run into the source ids.
  (Placed beside the sources, it first read as "resume:nokia 2 of 3 agree".)
- **A split:** "split · 1 met, 1 partial, 1 unmet" in the row's quiet line,
  under an `unclear` tag.
- **A row code changed after the vote:** the vote stays in the quiet line,
  for example "no source most of the assessments shared · downgraded from met".
- **Under a consensus table:** one note says what the counts mean. It appears
  only when `samples > 1`.

Unanimous rows look exactly as they do today. Every figure is a count; there
are no percentages and no decimals (decisions doc §3; tested). The print
sheet uses the same placement.

### Latency: wait, don't swap

**The choice is a quiet phase line while the other runs finish, with the
card landing once.** The other option was to stream the first run's rows and
then update them to the consensus. Waiting won, for three reasons:

- **The card already lands whole.** It renders when the `roleFit` result
  arrives. While the rows stream, the reader sees a count ("6/14"), not rows.
  Showing the first run's rows and then changing them would be new behaviour.
- **A flip teaches the wrong lesson.** Its main visible effect would be a
  reader watching `met` turn into `partial`, which shows that the tag is soft,
  the opposite of what this feature is for.
- **The wait is short, and swapping has a hole.** A link or export made
  before the swap would carry the wrong table. The runs start together, so
  the added wait is the slowest run minus the turn's own. That should usually
  be a few seconds, but it hasn't been measured live (see the last section).

While the card waits, the phase line reads **"cross-checking…"** with a
readout of how many runs are in (`2/3`), then the elapsed time. That fits on
one line at 375px; the width test now covers it. The route writes the count
as a `data-samples` part under one id. It writes once when the wait starts,
again on each arrival, and every 5 seconds after that, because the client's
stall watchdog fails a stream that is silent for 20 seconds, and a tool that
is waiting writes nothing else. The card waits at most 15 seconds
(`CONSISTENCY_GRACE_MS`) after the turn's own run arrives. A run that hasn't
arrived by then is stopped, and the card is merged from the runs that did
arrive.

### The prose matches the table

Today the model reads its own call and the reconciled result, then writes the
sentences after the card. Now:

- **The model reads the merged table.** The `roleFit` result is the merged
  table, through `toModelOutput`, which strips the vote counts: they are for
  the reader, and would only invite a sentence about the machinery. A route
  test asserts that the step after the card reads the consensus verdicts, not
  the turn's own.
- **The prompt says so.** One sentence was added to the `roleFit`
  instructions in `lib/system-prompt.ts`, which is published on `/prompt`:
  "The table the tool returns is the one the reader sees, and the site may
  have changed rows in it since your call. Write the sentences after the call
  from the returned table." It is true with or without the consensus:
  reconciler downgrades already changed rows.
- **The one-line `verdict` can still disagree.** It sits at the foot of the
  card and is written inside the call, before any merge. It comes from the run
  closest to the consensus, so where it disagrees it is about a contested row.
  Look for this in the live run.

### Cost

- **Only the judging step is multiplied.** Extraction and the summary run
  once.
- **The meter counts every run.** The extra runs' usage (input, cached input,
  cache writes, output, reasoning) is added into the turn's `usage`. So the
  cost meter, the turn log, PostHog's `chat_turn_complete` and the live eval
  harness all include them, with no change to any of them. Tokens per second
  still describes only the stream the reader sees.
- **A run that never reports is billed high.** That covers a failed run and
  one stopped after the grace period. It is counted at a ceiling: the judging
  step's whole prompt, uncached and priced as cache writes when the model
  prices those above fresh input, plus the whole output ceiling. A test checks
  that bound against every model in the catalogue, across a spread of cached,
  cache-written and fresh input and of output lengths up to the ceiling. The meter can read high, never low.
- **The turn record says how much was the extra runs.** `consistency` holds
  `requested`, `merged`, `extraUsage`, `estimated` (how many were billed at
  the ceiling) and each run's time.
- **The visitor spends one turn.** The extra runs never touch the hourly
  budget or the conversation cap (tested: `x-budget-remaining` drops by one).
- **What it adds:** docs/followups.md puts a whole posting turn on
  `openai/gpt-6-luna` at about $0.0025. Taking that as a ceiling for one
  extra run, a posting turn goes from about $0.0025 to at most about $0.0075.
  The worst case one IP can force is 20 posting turns an hour: about $0.15
  instead of $0.05.
- **Unchanged:** the shell's meter already skips a turn that ends in an
  error. That predates this work.

### Links and exports

New links carry `samples` on the table and `agreement` only on rows the runs
disagreed on. Old links have neither and render exactly as before; the panel
and the print sheet both check before showing anything. Here is the recorded
14-row fit check from `docs/application-links.md`, measured with the 40-character
`?ref=` from the existing tests:

| | Before | Every row disagreeing (worst case) |
| --- | --- | --- |
| Full conversation link | 3,299 | 3,349 (+50) |
| Short fit link | 1,655 | 1,689 (+34) |

The short link stays under the 2,000-character safe length. The copied
markdown, the scorecard and the mail draft (`lib/transcript.ts`) show the
consensus verdicts but not the split. Adding it there is a follow-up if
Sidhant wants it.

## What was tested

Everything runs offline and is part of `npm run eval`.

- **`evals/consistency.test.mjs` (43 tests), the merge:**
  - one run is `reconcileRoleFit` key for key, and a named role falls back
  - the vote: unanimous, 2–1 both ways, three-way split, met against unmet
    with a majority, partial against unmet, and order independence
  - citations: majority-shared sources only, the minority excluded, unshared
    downgrades, choosing the best-supported evidence, re-checking it, and
    invented ids staying flagged
  - the reconciler: uncited and skipped rows vote `unclear`, unjudged rows,
    reordered and paraphrased rows, rows outside the posting, gap additions,
    derived gaps, choosing the free-text run, and the panel's invariants
  - the agreement readback, including hostile values from a link, and the
    no-percentage rule
  - what the model reads, and the prompt sentence
  - link sizes, round trips, old links
  - the cost ceiling against every catalogue price
- **`evals/consistency-route.test.mjs` (12 tests), the real route:**
  - Set-up: the route is loaded as it ships, and every model call goes to
    the AI SDK's own mock model (`ai/test`), installed as the SDK's default
    provider. `fetch` throws and the key is a placeholder, so nothing can
    leave the process.
  - The card is the consensus, and each extra run gets the judging step's
    exact prompt, tools, choice, ceiling, reasoning level and signal.
  - The runs start within milliseconds of the judging step, not after it.
  - Progress parts appear only during the wait, under one id.
  - The summary step reads the merged table without the vote counts.
  - Usage adds up exactly and one budget turn is spent.
  - A failed run is left out of the vote and billed at the ceiling.
  - A question turn starts nothing.
  - A stalled run is given up on after the grace period, with heartbeats
    while waiting. Stop aborts everything.
- **`evals/turn-phase.test.mjs`:** the consensus stream adds exactly one step.
  Its readout is `1/3`, `2/3`, `3/3`, and it fits the 375px width budget. A
  single run's wait still reads "checking the fit…".
- **`evals/recursion.test.mjs`:** "the reconciler reads only the knowledge
  base" now follows the call through the merge.
- **Checks:**
  - `npm run build`: zero errors, and the postbuild marker check passes.
  - `npm run lint`: clean. `tsc --noEmit`: clean.
  - Full suite: 555 tests, all passing. That includes the rendered-marker
    check, which runs when a build is on disk.

**Screenshots** were taken on `next start -p 3105` with no API call:

- The card was shot from a permalink made from the recorded fit check, with
  synthetic votes on four rows run through the real merge and corpus.
- The phase line was shot by replaying the real route's stream (made with the
  mock model) through an in-page fetch override, which held the stream open.

## What still needs a live run, and what it costs

All of this is untested against a real model. Things to look for:

- whether the extra runs hit the prompt cache as the turn's own run does
- how long the card actually waits past the turn's own run
- how often the free-text `verdict` line disagrees with a contested row
- most of all, **whether the table now holds still across runs**

Run it against a local server only, never production. Give the server
`AI_GATEWAY_API_KEY` in `.env.local`.

```sh
npm run build && npx next start -p 3105
# three runs of the six job-description cases, each in its own budget bucket
for i in 1 2 3; do
  npm run eval:live -- --group roleFit --base http://localhost:3105 --ip 10.42.0.$i
  cp evals/results.json evals/results-consistency-$i.json
done
```

Then compare `counts` per case across the three files. Each result's
`telemetry.consistency` gives `merged`, `estimated` and each run's time.
`telemetry.usage` is the whole cost.

**Expected cost:** 18 posting turns.

- **Ceiling:** at most $0.0075 a turn at the $0.0025-per-run figure from
  docs/followups.md, so **at most about $0.14**.
- **Likely:** these postings are short, and a short posting measured $0.0007
  a turn at `low`, so the run is more likely **$0.03 to $0.05**.

For the long GTM posting in docs/followups.md, three turns cost at most about
$0.02. The posting-corpus stability harness another agent is building
(`scripts/run-fit-stability*`) is the better tool for the stability question
once it lands. With `CONSISTENCY_SAMPLES` set to 1, the same harness gives the
baseline.
