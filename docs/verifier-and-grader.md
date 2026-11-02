# The citation checker and the entailment grader

2026-11-02. Two changes, one for each direction the checker was wrong in:

1. **`lib/verify.ts` stops marking honest sentences.** Gap sentences in
   phrasings the old filter missed, and sentences that open on a capitalized
   common word ("Strong…"), no longer get the red mark. The rewrite also closes
   five holes the old filter had, where an invented employer or number inside
   a gap-looking clause went unchecked.
2. **`evals/grader/` measures what the checker can't see.** It's an LLM judge,
   run at eval time and never in the request path. It labels a claim against
   its cited chunk as supported, overstated, unsupported or an absence. It
   comes with a 97-row calibration set and a hard spend cap, and it runs fully
   offline with a stub.

Nothing visible on the site changed, so there's no copy-ledger section.

## Part A: what changed in the checker

The checker's contract hasn't changed. `verified` still means the numbers and
proper nouns in a sentence appear in the chunk it cites, and nothing more.
Two things changed: which parts of a sentence count as asserted, and which
capitalized words count as names.

### Absences: check everything except what the absence is about

Before, a clause that matched a gap pattern was dropped whole. That missed
phrasings ("Spark, Ray and Beam are gaps"), and it dropped too much. For
example, "The gaps are minor, and he led Salesforce at Google" was one
clause, so nothing in it was checked.

Now the checker finds the object of each absence, meaning the stretch that
names what's missing. Only that stretch goes unchecked. There are three
shapes:

| Shape | Examples | Object |
| --- | --- | --- |
| Lead | "the record does not show X", "hasn't run X", "the main gaps are X", "primary unknowns: X", "nothing touching X", "there's no X", "not X" at the start of a clause | what follows |
| Tail | "X are gaps", "X is outside the record", "X aren't listed", "X is not documented", "X is unknown" | what precedes |
| Bracket | "no X on the page", "no X in his record" | what's between |

A line that heads a list of gaps ("Biggest gaps:", "**Where he doesn't
match**", "There are three gaps:") makes each list item below it an object.
This holds even across a blank line. The list ends at the first line that
isn't an item.

The object is kept as small as the grammar allows, because nothing inside it
is checked:

- **It ends at a clause joint.** That means `;`, a colon, a spaced dash,
  "but", "while", a full stop the sentence splitter left in, or a coordinator
  followed by "he", "she", "it" or "they".
- **It ends where a clause about him starts again.** Examples are "…, and he
  led…" and "…, and Oracle hired him…". "His record" doesn't count as being
  about him.
- **A tail's object starts after the last clause that mentions him.** In "He
  spent 12 years at Oracle and CPQ is a gap", the object is "CPQ".
- **A denied gap isn't an absence.** "No gaps: 12 years at Oracle", "there are
  no real gaps:" and "Oracle is not a gap" are claims of coverage, and they
  are checked.
- **A gap he acted on isn't a label.** "He closed the gaps: 12 years at
  Oracle" is checked. "He has two gaps: …" is still a label.
- **"Not only", "not just" and "not merely" don't open an absence.**

One consequence is deliberate. A word before the trigger is now checked,
where before the whole clause was dropped. In "At Oracle, he hasn't run
Kubernetes", Oracle is checked and Kubernetes isn't. So an uncited gap
sentence that names his employer before the trigger now counts as an uncited
claim, because it states a checkable fact.

### Sentence-initial capitals: a name only when something says so

Some capitals are explained by position: the start of a sentence, a line or
a list item, or the word after a colon or a spaced dash. A word in one of
those positions is a name if:

1. its shape says so: an acronym, inner capitals, a digit or a dot (CPQ,
   TypeScript, B2B, B.S., Next.js); or
2. the record writes it capitalized mid-sentence somewhere (Glean, Teams,
   Power, Nokia). This is read from the record's own chunks, not the site's
   source, because code capitalizes identifiers; or
3. nothing marks it as an ordinary word.

It counts as ordinary when it's in a built-in list of common English words
(base forms, with inflections undone: "strongest" becomes strong, "shipped"
becomes ship), or when the record writes it lowercase.

The default is "name". That's the safe direction: "Google hired him." is
still checked and still marked, because "Google" is in neither list. The
common-word list leaves out words that double as products or companies a
posting could name, such as power, teams, spark, outreach, slack, notion,
looker, square and mode. A test pins 47 of them as still checkable in first
position.

Words that are mid-sentence are unaffected. Everything there is checked as
before.

**Known limits.** A sentence-initial company whose name is an ordinary word
(Target, Gap, Close) or a word the record uses in lowercase (Segment) reads
as ordinary. Only a sentence where it's the sole checkable token goes
unchecked, so "Target hired him." gets through and "Target hired him in
2019." doesn't. Table cells are joined with commas into one row sentence, so
a cell that opens with "Strong" is still read as a name. The common-word list
also adds about 8 KB (4 KB gzipped) to the client bundle, because
`lib/verify.ts` runs in the browser.

### The false-alarm table, before and after

The published runs can't be re-verified offline. `evals/published/latest.json`
keeps verdict counts per run, not the answers. This is by design: evals/README
says unreviewed model prose doesn't travel into the snapshot. What the data
does show for the 2026-10-20 bake-off is 10 claims found nowhere in the
record: Luna 1, DeepSeek 3, Haiku 5.5 3, gpt-5-mini 2 and Gemini 1, plus 1
more in the 02:27 solo Luna run. `docs/followups.md` read all ten and found
all ten honest: seven gap sentences and three "Strong" openers. I didn't
hand-edit `latest.json`.

What can be measured is in `evals/grader/checker-alarms.jsonl`. Each class
there is real output where it was recorded, and a labelled reconstruction
where it wasn't. The results are re-scored against the previous checker
(24d3770) in `evals/grader/checker-rescore.json`, by
`evals/grader/recheck.mjs`. An answer counts as "marked" when it gets an
`unverified` or `uncited` mark, which are the two a reader sees as an
accusation.

| Answers | Source | Rows | Marked before | Marked after |
| --- | --- | --- | --- | --- |
| Honest: bake-off gap sentences ("are gaps", "no X on the page", "nothing touching X", "primary unknowns", "4+ years") | rebuilt from the documented phrasings | 6 | 6 | 0 |
| Honest: "Biggest gaps:" list | rebuilt | 1 | 1 (2 marks) | 0 |
| Honest: "Strong…" openers | rebuilt | 3 | 3 | 0 |
| Honest: "Strongest matches are…" verdict | `docs/followups.md`, live 2026-10-19 | 1 | 1 | 0 |
| Honest: gap sentences pinned from the 2026-10-19 live run, and one quoted in followups | recorded | 7 | 0 | 0 |
| Honest: the recorded fit check's prose | `evals/fixtures/recorded-fit-check.json` | 1 | 0 | 0 |
| **All honest** | | **19** | **11** | **0** |
| Invented: a claim hidden in a gap clause or list | adversarial | 17 | 12 | 17 |
| Invented: other (opening name, beside a gap clause) | adversarial | 3 | 3 | 3 |
| **All invented** | | **20** | **15** | **20** |

The old filter let five invented answers through, each with a whole sentence
dropped:

- "The gaps are minor, and he led Salesforce at Google."
- "There are no real gaps: he spent 12 years at Oracle."
- "The main gap: he spent 12 years at Oracle."
- "The main gaps are CPQ and Gong, and Oracle hired him for 12 years."
- "Not only did he lead Salesforce at Google, he ran it."

The new checker catches all five. The static suite pins the "after" column
(`evals/checker-rescore.test.mjs`), plus 35 new checker tests in
`evals/citations.test.mjs`. Every earlier test still passes.

The reconstructed rows aren't the models' sentences. They use the phrasing
and the requirements the followups name, so they show that each class is
handled. They don't show that every real sentence is. Re-scoring a real run
needs its `evals/results.json`, which keeps the answers. The command is
below.

**For the lead:** the checker's rules changed, so citation counts from runs
before this commit don't compare with runs after it. `lib/measurements.ts`
keeps `CHECKER_REVISED` for exactly this. Move it when a run scored by this
checker is published. Republishing, and the change it makes to
/measurements, is your call.

## Part B: the entailment grader

### What it does

Given a claim and the text of the chunks it cites, a model returns one line
of JSON: `{"label", "reason"}`. There are four labels:

- **supported**: the sources state it, at its scope.
- **overstated**: the sources support a narrower version. This is the class
  the fact audit found.
- **unsupported**: nothing behind it, or contradicted.
- **absence**: the claim reports what the record lacks. A false absence
  ("the record does not show any Power BI work") is unsupported.

The prompt (`evals/grader/prompt.mjs`) spends most of its words on five kinds
of scope inflation, each drawn from the fact audit or the system prompt's
"Saying it the way the record says it":

- **Ownership verbs.** Built, inherited, extended, supported, ran, owned, led
  and designed are different claims.
- **Scale words.** "The systems", "all", "every", "teams", plurals beyond the
  count.
- **Causality.** "The data showed" or "steered" is not "decided".
- **Time scope.** "Since 2021" for a 2024 role, "first four months" when
  building began before launch.
- **Status.** In testing is not live, identified is not saved, a sizing is
  not pipeline.

The claim and its sources are fenced as data, because a live claim is model
output.

### The calibration set

`evals/grader/calibration.jsonl` has 97 rows, each with provenance. The
cited chunks are frozen per revision in `evals/grader/corpus/`, so a label
stays true of the text it was judged against when the record changes later.

| Kind | Where it comes from | supported | overstated | unsupported | absence |
| --- | --- | --- | --- | --- | --- |
| audit-before / audit-after | before/after wording from the fact audit (d0f5674), the A Darle 20 overclaim cut (18900fa) and the smoothing pass (218889f), judged against the corpus at d0f5674 | 18 | 17 | 3 | |
| record-sync-before / after | copy removed or rewritten when the site synced to the final resume (b7da2a6), judged against today's record; the ground truth is the system prompt's exact-shape rules from the same commit | 3 | 3 | 1 | |
| knowledge | sentences from `content/knowledge/`, cited to their own chunk | 16 | | | |
| prompt-rule | the system prompt's "Saying it the way the record says it" lines | 5 | | | |
| recorded-absence | gap sentences from live runs (the recorded fixture, followups, pinned tests) | | | | 5 |
| synthetic | perturbations of supported sentences, labelled synthetic, each naming its base and its perturbation (ownership, scale, causality, time, status, invented tool, false absence) | | 22 | 4 | |
| **Total** | | **42** | **42** | **8** | **5** |

Some notes on the set:

- **Where the overstated rows come from.** 20 of the 42 come from history
  and 22 are synthetic. Report both, and trust the history rows more,
  because the synthetic ones are labelled by construction.
- **Chains.** Several audit fixes were themselves corrected later, and each
  step is a row. "Quote to cash" became "the listed price", which became the
  final wording. The /projects intro went from "systems revenue runs on" to
  "built for sales and revenue teams" to "three things I built".
- **The audit-era rows grade claim against source, not claim against
  truth.** The d0f5674 record itself held claims the final resume narrowed
  later: "owned headcount…", "$129M in pipeline". An audit "after" row is
  supported by that record.
- **The frozen d0f5674 text is cut where the final record deliberately
  leaves things out.** That covers visitor counts and cash payments. The cuts
  are marked with an ellipsis, and a test checks they stay out. No label
  depends on them.
- **Rows to review.** The labels I'd most want Sidhant to check are
  `audit-how-i-build-before`, where the unscoped "AI agents write most of the
  code" was ruled overstated, and `audit-price`, where "a host lists a game
  session with a price" was ruled supported. Both are as the audit left them.

### The runner and the spend cap

`npm run eval:grade` goes through the Vercel AI Gateway with the `ai` package
that's already in deps. The default model is the chat's default from
`lib/models.ts`, `openai/gpt-6-luna`: confirmed list price $0.10/$0.50 per
1M, reasoning `low`, 600 output tokens at most. Pass `--model
anthropic/claude-haiku-5.5` (same list price) to grade Luna's own answers
with a different family.

The key is the production chat's, so the cap works like this:

- **Each call is priced before it may start.** Input is counted at three
  characters a token, at the full input rate, and the whole output ceiling
  is counted at the output rate. The call runs only if what's spent plus that
  worst case fits under `--max-usd`, which defaults to 0.50.
- **Calls run one at a time with retries off.** A failed call, or one with no
  usage, is charged its worst case. Three failures in a row end the run.
- **Prices without a published rate are budgeted at four times list.** That
  covers an `unconfirmed` price (DeepSeek billed 3.3 times its rate) and any
  `--price-input`/`--price-output` override. A model with no price at all
  can't run.
- **It reads the Gateway balance before starting.** If the balance less
  `--max-usd` would be under `--keep-usd` (default $2.00), it refuses to
  start, to leave that much for the chat. Afterwards it prints how far the
  Gateway's own count moved. That figure is an upper bound, because the key
  is shared.

Tests cover parsing, the math, the cap (including a sweep showing a run
never crosses it), failure charging, the calibration set's integrity, and an
end-to-end offline run: 33 in `evals/grader.test.mjs`.

The stub (`--stub`) is a keyword baseline and not a judge. It runs the whole
pipeline offline and gives a floor to beat. On the calibration set it scores
precision 0.88 (21/24) and recall 0.50 (21/42) on "overstated". On the 20
history rows alone it catches 6, which is the honest floor: its cue words
were written alongside the synthetic rows.

### Commands, once a key exists

```bash
npm run eval:grade -- --dry-run      # no key, no network: rows, label mix, projected cost
npm run eval:grade -- --stub         # offline end to end, the keyword floor

# The calibration set, live (AI_GATEWAY_API_KEY in the environment or .env.local):
npm run eval:grade                   # default model, cap $0.50
npm run eval:grade -- --model anthropic/claude-haiku-5.5 --max-usd 0.25

# A live run's verified claims, the grader's real job (after npm run eval:live):
npm run eval:grade -- --from-live evals/results.json

# Re-score answers with the old checker and this one (offline):
mkdir -p /tmp/before/lib
git show 24d3770:lib/verify.ts > /tmp/before/lib/verify.ts
git show 24d3770:lib/answer-blocks.ts > /tmp/before/lib/answer-blocks.ts
node --experimental-strip-types evals/grader/recheck.mjs \
  --before /tmp/before/lib/verify.ts --before-name 24d3770 \
  --results evals/results.json --out evals/grader/checker-rescore.json
```

Results go to `evals/grader/results.json`, which is git-ignored. They
include precision and recall on "overstated", the same for "overstated or
unsupported", accuracy, a per-kind breakdown and the confusion matrix.

### Expected cost

From the dry run, for the full calibration set of 97 rows on the default
model: **about $0.02 expected, $0.04 worst case**, against the $0.50 cap.
That's about 91,000 input tokens and at most 600 output tokens a call. Haiku
5.5 has the same list price. gpt-5-mini is $0.25/$2.00, so it would run
about $0.06 expected and $0.15 worst case. A `--from-live` run costs the same
per claim, around $0.0002 each.

## What's left

- **Running the grader.** It hasn't been run against a model, because there's
  no key in this sandbox. Its precision and recall are unmeasured until
  someone runs `npm run eval:grade`.
- **Re-scoring the bake-off.** Re-scoring the bake-off answers themselves
  needs the runs' `evals/results.json`, which was never committed.
- **Docs.** `evals/README.md` doesn't mention `eval:grade` yet. I left it
  alone because it isn't in this change's files.
