# The fit check at scale

Written 2026-11-02. The job-description fit check had been measured on three
postings, and on those it moved between runs: the same posting gave 5 to 7
unmet requirements at the default reasoning level, and one `none` run gave 2
unmet and 10 partial (docs/followups.md, "Reasoning on posting turns"). This
is the corpus and the harness to measure that properly: 502 real postings in
Sidhant's role families, and a runner that sends each one through the real
route several times and reports how much the verdicts agree.

**Status.** Built and tested offline. Not run against a model: there is no
`AI_GATEWAY_API_KEY` in the sandbox it was built in. Everything that needs a
key runs with one command once a key exists (below). The recommended first run
fits under $1.

## The short version

- **93% of real postings are longer than the paste panel accepts.** The panel
  takes 3,922 characters; the median posting in the corpus is 6,639. For
  nearly one posting in five (19%), the cut falls before the qualifications
  section starts, so the model assesses the posting without seeing a single
  qualification. See
  [the length finding](#length-finding).
- **The cut is silent.** `JobDescriptionForm` slices the textarea's value on
  every change (`components/shell/panel-body.tsx`), so a long paste is trimmed
  before anyone presses the button. The only sign is the counter reading
  3922/3922.
- **The 14-row card is a second cut.** The median posting has 23 list items,
  and even the part the panel keeps has more than 14 in half of postings.
- **The harness can vary the model but not the reasoning level.** The route
  takes reasoning from `lib/models.ts` and reads no per-request setting, so
  the earlier reasoning experiments used a temporary hook that was never
  committed. Until the route offers one, a run compares models at their
  catalogue settings.
- **The recommended first run:** GPT-6 Luna at its catalogue setting (`low` on
  posting turns), 10 postings from each of the seven strata, 3 repeats. That
  is 210 turns, an expected $0.59 (at most $0.77 at the dearest measured turn),
  and about an hour. The hard cap is $1.00. **These figures predate the
  consistent fit check** (`docs/consistent-fit-check.md`), which now runs
  three assessments per posting. Until a run measures it, assume up to 3×:
  about $1.30–1.80 for this run, which the $1.00 cap would stop partway.
  Run `--per-stratum 5` (105 turns) to stay under $1, or pass `--max-usd 2`.
  The spend guard's per-turn ceiling already counts the extra assessments.

## The corpus

<!-- generated:corpus -->
502 postings from 123 companies, fetched on 2026-11-02 from the public Greenhouse, Ashby and Lever board APIs by `scripts/fetch-postings.mjs`.

| Source | Boards | Postings |
| --- | --- | --- |
| greenhouse | 63 | 288 |
| ashby | 58 | 209 |
| lever | 2 | 5 |

**By family and control.** Families and controls are a title heuristic (`evals/lib/postings.mjs`), not a judgment of fit.

| Family / control | Postings | Share | Companies |
| --- | --- | --- | --- |
| revops | 91 | 18% | 53 |
| sales-ops | 54 | 11% | 38 |
| gtm-systems | 83 | 17% | 63 |
| sales-revenue-analytics | 75 | 15% | 53 |
| delivery-program-ops | 124 | 25% | 61 |
| near-miss (salesforce-admin 11, cpq-deal-desk 11, psa-delivery 3) | 25 | 5% | 24 |
| mismatch (staff-swe 12, people-manager 13, enterprise-ae 13, ml-infra 12) | 50 | 10% | 39 |

The gauntlet list: Anthropic 14, OpenAI 11, Ramp 3, Notion 4, Harvey 6, Sierra 10, Decagon 10, Vercel 3. In-family postings are capped at 9 per company so the largest boards don't stand in for the market.

<a id="length-finding"></a>
**The length finding.**

| Measure | Value |
| --- | --- |
| The paste panel's limit (`MAX_POSTING_TEXT`) | 3,922 characters (the route's `MAX_USER_TEXT` 4,000, less the prefix) |
| Posting length, p10 / p25 / median / p75 / p90 / max | 4,185 / 5,341 / 6,639 / 8,060 / 9,914 / 14,985 |
| Postings the panel cuts off | 467/502 (93%) |
| Characters lost when cut, median / p90 | 2,852 / 6,090 |
| Share of a cut posting the model sees, median | 58% |
| Qualifications section starts past the cut (the model sees none of it) | 96/400 postings with a recognisable header (24%); 19% of all postings |
| Company boilerplate before the role section, median | 1,005 characters (429 postings with a recognisable role header) |
| Salary stated in the text and lost to the cut | 69/85 |
| List items, median (whole posting / what the panel keeps) | 23 / 14 |
| More than 14 list items, the card's row limit (whole / kept) | 91% / 49% |

| Stratum | Median length | Cut off | Qualifications lost |
| --- | --- | --- | --- |
| revops | 6,470 | 92% | 22% |
| sales-ops | 6,959 | 96% | 19% |
| gtm-systems | 6,866 | 95% | 22% |
| sales-revenue-analytics | 6,620 | 93% | 17% |
| delivery-program-ops | 6,484 | 90% | 19% |
| near-miss | 6,417 | 92% | 16% |
| mismatch | 6,503 | 94% | 14% |
<!-- /generated:corpus -->

### How it was built

`scripts/fetch-postings.mjs` reads the public job-board APIs that hosted
career pages are built on: Greenhouse
(`boards-api.greenhouse.io/v1/boards/<token>/jobs?content=true`), Ashby
(`api.ashbyhq.com/posting-api/job-board/<org>?includeCompensation=true`) and
Lever (`api.lever.co/v0/postings/<company>?mode=json`). It is polite: one
request at a time, 750 ms apart, a User-Agent that says what it is, and one
retry on a 429 or 5xx. The 125 boards were found by probing candidate tokens
for AI-forward and B2B SaaS companies, starting with the gauntlet list. Most
companies are on Greenhouse or Ashby. Most Lever boards tried were empty or
gone. Outreach, JumpCloud and Palantir answered, and none of Palantir's titles
fell in a family. Each company is read from one board only.

From each board:

1. **HTML to text.** `htmlToText` in `evals/lib/postings.mjs` produces what
   selecting the page and pasting it would give: headings and paragraphs on
   their own lines, list items as `- ` lines, no markup or entities.
   Greenhouse's HTML arrives entity-escaped and is decoded first. Its content
   includes the company introduction and closing sections, as the page does.
2. **Labelling.** A title heuristic assigns a family (RevOps, sales ops, GTM
   and business systems, sales and revenue analytics, delivery and program
   ops) or a control:
   - **Mismatch**, about 10%: ML infrastructure and research engineering,
     staff and principal software engineering, quota-carrying account
     executives, and engineering managers. Nothing in the record covers these.
   - **Near miss**, about 5%: Salesforce admin and developer roles, CPQ, deal
     desk and order-to-cash roles, and delivery roles whose text centres on
     PSA, SOWs and billable utilization. These are the gaps the gauntlet log
     names.
   - Titles outside every family (recruiting, finance, security, legal,
     enablement and so on) are dropped.

   Generic business-operations and strategy-and-operations roles count as
   delivery and program ops. The labels describe the posting, not Sidhant's
   fit. The fit is what the harness measures.
3. **Filtering.** Anything under 800 characters is dropped. Duplicates are
   dropped too: the same text twice, or a role reposted per city (the same
   company and near-identical text, which also catches "…, Germany" and
   "…, France"). In-family postings are capped at 9 per company, chosen by a
   hash of the id, so the largest boards don't stand in for the market.
   Controls are spread across their kinds and companies.

**The corpus is not committed.** It is other companies' posting text, and
this repo is public, so `evals/postings/corpus.jsonl(.gz)` is git-ignored.
Run `npm run postings:fetch` to build it locally. The boards change daily, so
a fresh fetch will not match the 502 postings counted here exactly. Committing
it is Sidhant's call: drop the two corpus lines from `.gitignore` and add the
file.

Each line of `evals/postings/corpus.jsonl.gz` carries:

| Field | Meaning |
| --- | --- |
| `id`, `company`, `title`, `url`, `source` | `source:board:jobId`; the hosted page; greenhouse, ashby or lever |
| `fetchedAt`, `publishedAt` | when this script read the board; when the company posted it |
| `location`, `compensation`, `compensationSource` | as the board states them; compensation from the board's own field, or else a range found on a pay line in the text |
| `family`, `control`, `controlKind` | the heuristic labels above |
| `length`, `cutBySite`, `charsLost` | full length in characters (as the textarea counts them), whether the paste panel cuts it, and by how much |
| `qualificationsAt`, `qualificationsLost`, `roleAt`, `listItems` | where a recognisable qualifications header and role header start, whether the cut falls before the qualifications, and the count of list items |
| `text` | the posting as plain text |

It is gzipped because the plain file is 3.7 MB. To refresh it, run
`npm run postings:fetch`. That takes a few minutes and replaces the file.
Pass `--cache <dir>` to keep the raw board responses while iterating on the
labels.

### `evals/postings/mine.jsonl`

This is the slot for postings Sidhant is actually applying to. It is empty.
Its format is one JSON object per line, and only `text` is required, so
pasting a posting as `{"company":"…","title":"…","text":"…"}` is enough. Run a
check over it with `--postings evals/postings/mine.jsonl`.

**The repo is public.** A committed `mine.jsonl` would publish which companies
he is applying to, which `docs/application-links.md` already says to keep out
of the repo. So it stays empty in git. Either fill it and never commit it (for
example with `git update-index --skip-worktree evals/postings/mine.jsonl`), or
keep the real list somewhere private and point `--postings` at that file.

### <a id="length-cap"></a>What the length finding means

The route caps a user turn at `MAX_USER_TEXT` = 4,000 characters
(`lib/job-posting.ts`). The panel takes that less the prefix and a blank line:
3,922. The route turns away anything longer with a 400, so a harness can't
send a whole posting either. It sends what the panel would.

The corpus shows the cap is the wrong size for real postings, not just for an
occasional long one:

| Cap on the turn | Postings that fit whole | Postings whose qualifications start past the cut |
| --- | --- | --- |
| 4,000 (today) | 7% | 96 |
| 6,000 | 36% | 9 |
| 8,000 | 73% | 0 |
| 10,000 | 90% | 0 |
| 12,000 | 98% | 0 |

What a bigger cap costs: the posting is resent on each of the turn's three
steps. By the length scaling the cost model uses, a median posting sent whole
would cost about $0.0046 on GPT-6 Luna at `low`, against $0.0028 cut. At
12,000 characters the cost would be about $0.0080.

**Decisions for Sidhant.** None of these is in this branch, because the route
and the form belong to other work:

1. Raise `MAX_USER_TEXT`. An 8,000-character cap loses no qualifications
   section in this corpus, and 12,000 fits 98% of postings whole. It is also
   the per-turn cost ceiling and the abuse bound. The hourly budget still
   bounds abuse.
2. Say so when the panel cuts a paste. That is new visible copy for the
   ledger.
3. Strip boilerplate before sending. The company introduction runs about
   1,000 characters in the median posting. The trouble is that a heuristic
   that strips wrongly loses requirements silently, which is today's problem
   in another place.

## The harness

### What one turn sends

Each turn is exactly what the paste panel sends from a fresh conversation
(`jdRequestBody` in `evals/lib/fit-stability.mjs`):

- **The text.** `JobDescriptionForm` slices the paste at 3,922 and trims it.
  `submitJd` prepends `JD_PREFIX` and a blank line, and `submit()` trims
  again.
- **The body.** `DefaultChatTransport` posts
  `{ id, messages: [one user message], trigger: "submit-message", model }`.
  The model goes in the body, as the picker sends it.
- **The reasoning level.** It isn't in the request at all. The route applies
  `reasoningFor(model, { jobPosting: true })`, which is `low` for GPT-6 Luna
  and the provider's default for every other model. Results are labelled with
  that level.
- **The rate limit.** Each turn gets its own budget bucket, sent as
  `x-forwarded-for: <--ip prefix>-<cell>`, as in `evals/run-live.mjs`. As
  there, a run with `--ip` set measures the model and says nothing about the
  rate limiter. It only works against a server that trusts the header, which
  localhost does.

A static test checks that the form, `submitJd` and the route still have the
shapes this mirrors.

### What is recorded per turn

One JSON line per turn goes to `evals/postings/runs/fit-stability.jsonl`. That
file is git-ignored, because row evidence and answers are unreviewed model
output about Sidhant. The line holds:

- **The tools.** Whether `extractRequirements` and `roleFit` were called, and
  how often. A second `roleFit` call renders as a second card.
- **The extraction.** The requirement count and the extracted list.
- **Each row of the reconciled card.** Its requirement, verdict, claimed
  verdict, downgrade, sources, unknown sources, unverified tokens and
  evidence.
- **The verify pass**, re-run with `lib/verify.ts` over what the card and
  answer show, against the same chunk lookup the site renders with (record
  plus repo, as `lib/corpus.ts` builds it). A met or partial row passes when
  it cites a real chunk and none of its checkable tokens are missing. The
  answer's claims go through `verifyAnswer`.
- **Timings.** Measured at the client from send: first byte, extraction
  start and done, card start and done, first text, done, and the longest
  quiet gap. That gap is flagged when it passes the browser's 20 s stall
  watchdog.
- **The closing telemetry.** Tokens (input, cached, output, reasoning),
  `finishReason`, steps and the tools called.
- **Cost.** The list price via `lib/pricing.ts`, and what the spend guard
  charged.
- **Blank turns**: no card and no text.

### Matching rows across repeats

A row is identified by its requirement text, which the extraction copies from
the posting. Across repeats the extraction trims a bullet, splits or merges
two, or reorders them, so exact matching would undercount agreement. The
method (`requirementSimilarity`, `matchRows`, `clusterRepeats`):

1. **Normalize.** Lowercase, strip bullets and punctuation, collapse spaces.
   Equal normalized text scores 1.
2. **Compare content words.** Take the words with stopwords removed and
   plurals folded. The score is their Dice overlap. When the smaller side has
   three or more content words, the score can instead be the share of the
   smaller side found in the larger: this catches a trimmed copy of the same
   bullet. That share is discounted to 0.9, so an exact pair always outranks
   it. A one-word requirement matches only by Dice, so "SQL" doesn't swallow
   every row that mentions SQL.
3. **Pair one to one**, best score first, at 0.5 or above.
4. **Cluster across N repeats.** Each repeat's rows join the clusters built so
   far, scored against every member already in a cluster, at most one row per
   repeat per cluster. A row that joins nothing starts a cluster of its own.
   Each cluster is one requirement as the repeats saw it.

The tests pin the cases this has to get right: reorders, a rephrased row, a
dropped row, and a one-word requirement.

### The metrics

Each metric is computed per setting (model × reasoning level) and printed with
its denominator:

- **Tool-call rate.** Turns that called both tools; blank turns; second cards;
  finish reasons; turns that would trip the stall watchdog.
- **Extraction-count agreement.** Postings whose repeats all extracted the
  same number of requirements. Also reported: how many hit the 14-row cap.
- **Counts differ.** Postings whose met/partial/unmet/unclear counts are not
  identical across repeats. This is what a recruiter re-running the check
  would notice.
- **Unstable rows.** Clusters present in two or more repeats that didn't get
  one verdict. Also reported: met in one repeat and unmet in another (the
  flip that matters most), pairwise row agreement, Fleiss' kappa over the rows
  every repeat has, and rows missing from some repeat (extraction drift).
- **Negative controls.** The verdict mix on mismatch and near-miss rows, and
  the share of mismatch cards that are at least half unmet or unclear. A
  mismatch posting rated mostly met means the check is flattering rather than
  reading.
- **Citations.** Met and partial rows that verify; answer claims that verify;
  rows downgraded for citing nothing; invented chunk ids.
- **Cost and latency.** Median, p90 and max of list price, extraction, card,
  done, longest gap and tokens.

### Spend safety

The key is shared with production, and the account's budget of about
$10 CAD a month is what keeps the production chat alive. So the runner does
the following:

- **Hard cap.** `--max-usd` defaults to 1.00, at list price. Before every
  request the runner reserves that turn's **ceiling**: the most one posting
  turn can cost under the route's limits. That assumes four steps at 4,000
  output tokens each, every input token uncached, and each step carrying
  every earlier step's output plus two `roleFit` results. For GPT-6 Luna at
  the length cap the ceiling is $0.024, about eight times a measured turn.
  When the turn ends, the reservation settles to its measured cost. A turn
  that reports no usage (a broken stream) stays charged at its ceiling. With
  turns in flight, a worker waits for them to settle before deciding the cap
  is reached. So the list-price total cannot pass the cap however a turn
  goes. A test settles turns until the guard refuses one and checks the cap
  at every step.
- **Restarts don't get a fresh dollar.** Spend already recorded in the
  results file counts against the cap.
- **Unconfirmed prices.** A model whose price is `unconfirmed` (DeepSeek) is
  charged at four times list. It billed 3.3 times list in the bake-off.
- **The Gateway's own meter.** The runner reads
  `GET https://ai-gateway.vercel.sh/v1/credits` before the run, every 25
  turns and after. It stops if the billed difference passes the cap, which
  covers a provider billing above list. Because production shares the key,
  that difference is an upper bound. The runner reads the key from its own
  environment for this call only.
- **A reserve for production.** It won't start if the balance less the cap
  would leave less than `--reserve-usd` (default 2.00).
- **Where it may send.** It refuses the production site outright, refuses
  any other non-local `--base` without `--allow-remote`, and refuses a plan
  over 20 turns without `--ip`.
- **Clean stops.** A 502 `upstream_unconfigured` (no key on the server) stops
  at once, with nothing spent. So does a 429, which means the buckets aren't
  working. Three transport failures in a row stop the run too.
- **Exit codes.** 0 done; 2 stopped for another reason; 3 the server has no
  key; 4 rate limited; 5 the cap was reached; 130 interrupted.

**Resuming.** Results are appended as each turn finishes. Run the same command
again and it skips every finished turn and retries the broken ones.

### Projected cost

<!-- generated:projection -->
Per-turn cost is the mean of the measured posting turns in docs/followups.md (list price, the 2,500-character posting), scaled to each posting's length as sent (at most 3,922 characters, so a cut posting costs what its first 3,922 characters cost). The range runs to the dearest measured turn. "Billed" rows multiply by 4 for the price the Gateway actually charged an `unconfirmed` model (3.3x in the bake-off). Hours assume one turn at a time.

| Model | Reasoning | Turns measured | Per turn at the cap | Full corpus × 3 (1506 turns) | Full corpus time | First run (70 × 3) |
| --- | --- | --- | --- | --- | --- | --- |
| openai/gpt-6-luna (catalogue) | low | 3 | $0.0028 | $4.24 – $5.48 | 6.8 h | $0.59 – $0.77 |
| openai/gpt-6-luna | provider-default | 5 | $0.0041 | $6.05 – $7.68 | 15.2 h | $0.85 – $1.07 |
| openai/gpt-6-luna | none | 2 | $0.0029 | $4.28 – $5.26 | 7.7 h | $0.60 – $0.74 |
| deepseek/deepseek-v4-flash-0731 (catalogue) | provider-default | 1 | $0.0011 | $1.67 – $6.67 billed | 18.1 h | $0.23 – $0.93 |
| deepseek/deepseek-v4-flash-0731 | none | 1 | $0.0013 | $1.89 – $7.55 billed | 7.7 h | $0.26 – $1.05 |
| anthropic/claude-haiku-5.5 (catalogue) | provider-default | 1 | $0.0071 | $10.64 – $10.64 | 9.2 h | $1.49 – $1.49 |
| anthropic/claude-haiku-5.5 | none | 1 | $0.0059 | $8.86 – $8.86 | 6.5 h | $1.24 – $1.24 |
| openai/gpt-5-mini (catalogue) | provider-default | 1 | $0.0290 | $43.34 – $43.34 | 30.3 h | $6.06 – $6.06 |
| google/gemini-3.5-flash-lite (catalogue) | provider-default | 1 | $0.0132 | $19.65 – $19.65 | 2.0 h | $2.75 – $2.75 |

Only the "(catalogue)" rows can run today: the route sets reasoning from `lib/models.ts` and reads no per-request level. The others need the route change described below. The spend guard's per-turn ceiling for GPT-6 Luna at the cap is $0.0241, about 8 times a measured turn; it only decides when the run stops, never what it spends.
<!-- /generated:projection -->

`--dry-run` prints the same projection for any selection. On the full corpus
(502 postings × 3 repeats) on the default model, it projects:

```text
  turns      1506 planned, 0 already done, 1506 to send
    setting                                           turns   expected       high    ceiling    hours
    openai/gpt-6-luna|low                              1506    $4.2404    $5.4833   $36.3347      6.8
  Cap $1.00.
  The high estimate is over the cap: the run would stop part-way, at about 274 of 1506 turns.
```

All five catalogue models over the full corpus project to $79.54 expected.
GPT-5 mini alone would be $43.34 of that. That is a month of the budget
several times over, and it is why the default cap is a dollar.

## Commands, once a key exists

```bash
# 1. Build and serve on a local port. next start reads .env.local, as npm run dev does.
npm run build && npx next start -p 3102

# 2. In another terminal, see the plan and its cost. Nothing is sent.
npm run fit:run -- --base http://localhost:3102 --ip fit-1 --per-stratum 10 --dry-run

# 3. Run it. fit:run loads .env.local into the runner too, for the credits endpoint.
npm run fit:run -- --base http://localhost:3102 --ip fit-1 --per-stratum 10

# 4. Render the tables into this doc.
npm run fit:report
```

`npm run fit:run` runs `node --env-file-if-exists=.env.local
scripts/run-fit-stability.mjs`. Interrupt it with Ctrl-C and re-run the same
command to carry on. To check postings he is applying to, run
`npm run fit:run -- --base http://localhost:3102 --ip mine --postings evals/postings/mine.jsonl`.

### The recommended first run

The run is `--per-stratum 10` on the default model at its catalogue setting,
with 3 repeats:

- **What it sends.** 70 postings: 10 from each family, 10 near misses and 10
  mismatches. That is 210 turns.
- **What it costs.** $0.59 expected and $0.77 at the dearest measured turn,
  against a $1.00 cap that stops it regardless. Measured before the fit check
  ran three assessments per posting: expect up to 3× that now (see the short
  version above). It takes about an hour, one
  turn at a time.
- **What it answers.** The question the three-posting runs raised: on the
  default setting, how often does a re-run change the counts, and which rows
  move? Ten per stratum is enough to see whether delivery and analytics
  postings, the families furthest from his core record, are less stable than
  RevOps.
- **Why not more.** It leaves room under the dollar, and it leaves most of the
  month's budget alone.

After it, in this order:

1. **The full corpus on the default model.** This projects to $4.24–$5.48.
   Raise `--max-usd` to about 5.50 deliberately, and only if the first run
   shows instability worth characterising.
2. **A second model.** Claude Haiku 5.5 at 5 per stratum (105 turns) projects
   to about $0.75.
3. **Reasoning levels.** These need the route change below.

## What the route would need

Nothing in the route was changed on this branch. These are the asks, in order
of how much they block:

1. **A per-request reasoning level for evals.** For example, a header the
   route honours only when an environment flag is set, never in production.
   Without it, the harness can't compare `none`, `low` and the default, which
   is the experiment the three-posting runs pointed at. The runner already
   sends `--reasoning-header <name>` when given one. If a `none` turn reports
   reasoning tokens, it stops, because that means the header was ignored.
2. **The effective reasoning level in the closing telemetry.** Today a run
   cannot prove which level it measured. That check on `none` turns is the
   only evidence available.
3. **The Gateway's billed cost per turn in the telemetry** (from its response
   metadata). docs/followups.md §2 item 2 asks for the same, for the meter.
   The harness would then charge billed cost rather than list price times a
   multiplier.

## Proof it works without a key

- **The mock.** `evals/lib/mock-chat-server.mjs` replays
  `evals/fixtures/recorded-fit-check.json` in the route's own stream format.
  That covers SSE framing, both tool calls, reasoning events, the opening and
  closing `data-turn` records, the per-IP hourly budget and the early-exit
  JSON errors. It varies each repeat with a seed: a verdict moves to a
  neighbour, a requirement is dropped or trimmed, and a mismatch-shaped
  posting leans unmet. That gives the agreement arithmetic something to find.
- **What ran against the mock.** On port 3102 in `mixed` mode, which adds
  blank turns and stream errors:
  - A 63-turn plan (3 per stratum) in three invocations. The first was
    limited to 12 postings and sent 36 turns. The second skipped those 36,
    sent the other 27 and hit one stream error, which was charged at its
    ceiling. The third sent only that one turn again.
  - A cap test at `--max-usd 0.05` with three turns in flight. It stopped at
    $0.0264 with exit code 5 and never passed the cap.
- **The real route without a key.** `next start` on this branch, with no key,
  answered the first turn with HTTP 502 `upstream_unconfigured`. The runner
  recorded it at $0, stopped and exited 3.
- **The unit tests.** `evals/fit-stability.test.mjs` runs in `npm run eval`.
  It covers the corpus helpers, the request body, the stream reader, every
  mock mode in-process (no port), row matching, the agreement arithmetic and
  Fleiss' kappa, the spend guard, the cost model and the corpus's invariants.
  It also checks that the route limits the ceiling assumes are the route's.

The tables below are that mock run, rendered by the report script. They show
the report working. They are not measurements.

One number in them is real, for a reason of its own. Only about half the
replayed met and partial rows verify, and two chunk ids show as invented.
That's because the fixture was recorded on 2026-10-19, before the knowledge
base was resynced with the final resume. It cites `resume:technical-skills`
and `nokia:what-he-built`, which no longer exist, and some of its evidence
quotes numbers the current chunks don't hold. The fixture's own tests use it
only for permalink length, so nothing else notices.

<!-- generated:results -->
> **A mock replay, not a measurement.** These turns came from `evals/lib/mock-chat-server.mjs`, which replays one recorded fit check with seeded variation. They show the harness and this report working end to end. None of these numbers describes a model.

64 records from 3 invocation(s), on 2026-11-02, against http://localhost:3102. Source: `evals/postings/runs/mock.jsonl`.

**Did the card render.**

| Setting | Turns | Statuses | Both tools called | Blank | Second card | Would stall (>20 s gap) | Finish reasons |
| --- | --- | --- | --- | --- | --- | --- | --- |
| openai/gpt-6-luna (low) | 63 | ok 63 | 57/63 (90%) | 6/63 (10%) | 0/63 (0%) | 0/63 (0%) | length 6, stop 57 |

**Stability across repeats.** Rows are matched by requirement text (method below); a row is unstable when the repeats that have it don't all give it the same verdict.

| Setting | Postings compared | Same requirement count | Met/partial/unmet/unclear counts differ | Unstable rows | Met in one repeat, unmet in another | Pairwise row agreement | Fleiss' κ | Rows missing from some repeat |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| openai/gpt-6-luna (low) | 21 | 12/21 (57%) | 21/21 (100%) | 103/290 (36%) | 15/290 (5%) | 506/690 (73%) | 0.50 (200 rows × 3) | 13/296 (4%) |

**Verdicts by control.** Share of rows. The mismatch postings should come back mostly unmet.

| Setting | In family (met / partial / unmet / unclear) | Near miss | Mismatch | Mismatch cards at least half unmet or unclear |
| --- | --- | --- | --- | --- |
| openai/gpt-6-luna (low) | 21% / 67% / 11% / 0% | 23% / 70% / 6% / 0% | 5% / 13% / 83% / 0% | 8/8 (100%) |

**Citations**, checked with `lib/verify.ts` as the site checks them.

| Setting | Met and partial rows that verify | Answer claims that verify | Rows downgraded for citing nothing | Invented chunk ids |
| --- | --- | --- | --- | --- |
| openai/gpt-6-luna (low) | 303/623 (49%) | 57/57 (100%) | 0 | resume:technical-skills, nokia:what-he-built |

**Cost and latency** (median / p90 / max).

| Setting | List price per turn | Run total (charged) | Extraction done | Card | Done | Longest gap | Input tokens | Output tokens | Requirements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| openai/gpt-6-luna (low) | $0.0019 / $0.0019 / $0.0021 | $0.1196 | 0.0 s / 0.1 s / 0.1 s | 0.2 s / 0.2 s / 0.3 s | 0.3 s / 0.3 s / 0.3 s | 0.0 s / 0.0 s / 0.1 s | 22,528 / 22,528 / 22,528 | 1,960 / 1,960 / 4,000 | 14 / 14 / 14 |

**By stratum** (openai/gpt-6-luna (low)).

| Stratum | Postings | Counts differ | Unstable rows | Unmet share |
| --- | --- | --- | --- | --- |
| revops | 3 | 3/3 (100%) | 10/41 (24%) | 2% |
| sales-ops | 3 | 3/3 (100%) | 13/42 (31%) | 22% |
| gtm-systems | 3 | 3/3 (100%) | 14/41 (34%) | 5% |
| sales-revenue-analytics | 3 | 3/3 (100%) | 20/42 (48%) | 24% |
| delivery-program-ops | 3 | 3/3 (100%) | 12/40 (30%) | 4% |
| near-miss | 3 | 3/3 (100%) | 17/42 (40%) | 6% |
| mismatch | 3 | 3/3 (100%) | 17/42 (40%) | 83% |

**Most unstable postings.** Counts are met/partial/unmet/unclear per repeat.

| Company | Posting | Stratum | Unstable rows | Counts per repeat |
| --- | --- | --- | --- | --- |
| Modal | Analytics Engineer | sales-revenue-analytics | 9/14 | 3/5/6/0, 0/2/12/0 |
| Perplexity | Engineering Manager (Enterprise) | mismatch | 7/14 | 0/1/13/0, 1/1/12/0, 1/3/9/0 |
| Otter.ai | Salesforce Administrator | near-miss | 7/14 | 4/9/1/0, 4/9/1/0, 1/10/2/0 |
| Twilio | Senior Analytics Engineer | sales-revenue-analytics | 6/14 | 5/5/4/0, 4/9/1/0, 5/8/1/0 |
| Klaviyo | Lead, Global Services Strategy & Operations | near-miss | 6/14 | 4/8/2/0, 4/10/0/0, 5/8/1/0 |
| Braze | Senior Sales Operations Analyst | sales-ops | 6/14 | 1/2/11/0, 2/2/10/0 |
| Figma | Business Systems Analyst | gtm-systems | 6/14 | 3/9/2/0, 3/10/1/0, 3/10/1/0 |
| Figma | Senior Account Executive, SMB | mismatch | 6/14 | 1/1/12/0, 1/2/11/0, 0/3/11/0 |
| Cribl | Staff Data Analyst | sales-revenue-analytics | 5/14 | 5/7/2/0, 4/10/0/0, 4/9/1/0 |
| Anaplan | Solutions Implementation Manager | delivery-program-ops | 5/14 | 4/10/0/0, 2/12/0/0, 3/8/2/0 |
<!-- /generated:results -->

## Files

| File | What it is |
| --- | --- |
| `evals/postings/corpus.jsonl.gz` | the corpus, git-ignored; built by `npm run postings:fetch` |
| `evals/postings/mine.jsonl` | empty slot for postings he applies to; see the privacy note |
| `evals/postings/runs/` | results, git-ignored |
| `scripts/fetch-postings.mjs` | refreshes the corpus (`npm run postings:fetch`) |
| `scripts/run-fit-stability.mjs` | the runner (`npm run fit:run`) |
| `scripts/report-fit-stability.mjs` | fills this doc's generated blocks (`npm run fit:report`) |
| `evals/lib/postings.mjs` | HTML to text, labels, dedupe, length facts |
| `evals/lib/fit-stability.mjs` | request, stream reader, matching, agreement, spend guard, cost model |
| `evals/lib/mock-chat-server.mjs` | the stand-in route (`npm run fit:mock`) |
| `evals/fit-stability.test.mjs` | the tests |
