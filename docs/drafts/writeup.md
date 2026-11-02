# Write-up draft: "How I built a chatbot that can't lie about me"

Status: **draft**, 2026-11-02, for Sidhant to rewrite in his own voice. Not
rendered anywhere, so `[VERIFY]` markers are allowed in this file. Logged in
`docs/copy-ledger.md` under "Write-up draft, 2026-11-02".

## Notes for Sidhant before you read

- **Sourcing.** Every paragraph is followed by an HTML comment naming the repo
  file (and section) its facts come from. Career facts come only from
  `content/knowledge/` and the resume. Delete the comments when you publish.
- **Your words.** Text in quotation marks attributed to you is copied verbatim
  from `docs/idea-decisions.md`, which records your dictated decisions. Nothing
  else is yours yet. Anything about how you felt, why you did something, or how
  you see the RevOps connection is either marked `[VERIFY]` or left as a prompt
  for you to fill in.
- **"I" and the agents.** The docs often don't say who ran a test (you or an
  agent), so the draft uses "a smoke test showed" rather than "I ran". Change
  those to "I" wherever it was you.
- **The title overclaims, by the site's own rule.** The roadmap says
  "verified" must never be upgraded to "true" (Sprint 3 results, item 5). The
  post says so in the "Every claim points at a line" section, which makes the
  title a setup the body corrects. If that reads as a bait-and-switch, two
  alternatives that match what `lib/verify.ts` does: "How I built a chatbot that
  gets caught when it makes things up about me" or "A chatbot about me that has
  to show its work".
- **If this post ever goes on the site itself:** the body mentions "a VERIFY
  marker" without brackets on purpose. A bracketed one in a rendered page fails
  `postbuild`.
- **Style.** Written against the copy pass's list of AI-sounding patterns
  (`docs/copy-ledger.md`, "Copy pass, 2026-10-20"): no prose em dashes, few
  "X, not Y" contrasts. The em dashes that remain are inside your quotes or the
  published prompt, verbatim.
- **Length.** The post body is about 1,780 words, not counting comments, figure
  placeholders and markers, so your answers to the prompts will push it past
  1,800. The easiest cuts: the front-door paragraph under "What the chatbot
  is", and the last paragraph of "Measuring it".

---

# How I built a chatbot that can't lie about me

## The question that came back empty

In October, two model-run reviews of my portfolio reported the same problem:
some questions to its chatbot came back blank. A smoke test that followed sent
the homepage's four suggested questions and one pasted job posting to every
model the site offered. Five of the 35 turns ended with no text and no card.
The stream closed cleanly, the status light stayed green, and the page showed
nothing.

<!-- source: docs/copy-ledger.md, "Wave 1 of the council plan, 2026-10-19" ("what the two council reviews found broken: a turn that ends blank"); docs/followups.md, "Smoke test, 2026-10-19" (method; "Five of the 35 turns ended with no text and no card, behind a green dot"); lib/chat-transport.ts, "A turn that said nothing" ("the stream closes cleanly, the SDK says 'ready', and the shell shows nothing") -->

One of the blanks was the question I most needed the site to answer: the chip
asking whether I'm a fit for a RevOps role. The default model at the time had
spent all 600 of its output tokens reasoning and never wrote a word. On the
pasted posting it spent all 4,000.

<!-- source: docs/followups.md, "Smoke test, 2026-10-19", "Every turn" table, deepseek-v4-flash-0731 default rows "RevOps fit" (600/600 reasoning, finishReason length) and "JD" (4,000/4,000); app/api/chat/route.ts, MAX_OUTPUT_TOKENS = 600 and MAX_OUTPUT_TOKENS_JD = 4000 -->

[VERIFY: a sentence or two, in your words, on what it was like to find this. The docs don't record your reaction.]

The site's whole argument is that its readouts can be checked, so a green
light over an empty answer was about the worst bug it could have. Now the chat
notices a turn that finished with nothing on the page and fails it visibly,
with "try again" and an offer to ask a different model. The default also moved
to GPT-6 Luna, and a re-test on it rendered five of five.

<!-- source: docs/sprint-3-grounding.md, "Intent" ("a site whose argument is that its instruments are honest"); lib/chat-transport.ts, "A turn that said nothing"; docs/copy-ledger.md, "Wave 1 of the council plan" (TURN_FAILURES.empty_answer; "ask {model} instead"); docs/followups.md, "Decided 2026-10-19" and "Re-test on the committed default, 2026-10-19" ("5/5 rendered") -->

> **Figure 1 goes here.** Brief below: the empty turn, then and now.

## What the chatbot is

sidhantmathur.com is a portfolio with an assistant you can ask about my work.
It answers from six markdown files: my resume, a short bio, an FAQ and one file
per project. There's no retrieval and no vector database. The whole record goes
into the system prompt on every turn, byte for byte the same, so the provider
serves most of it from cache and an ordinary question costs under a tenth of a
cent.

<!-- source: content/knowledge/ (bio.md, faq.md, projects-adarle20.md, projects-dell.md, projects-nokia.md, resume.md); docs/roadmap.md, "What grounding the plan in the code changed", fact 1 ("There is no retrieval"); docs/sprint-3-grounding.md, constraint 1 (byte-identical prompt); docs/followups.md, "Re-test on the committed default, 2026-10-19" (6,250 input tokens, 6,237 cached, on the visa turn) and the smoke test's recommendation ("under a tenth of a cent each") -->

The chat is optional. My rule for the homepage was "I want 5-second clarity on
this site," and "They shouldn't be required to engage with a chatbot."

<!-- source: docs/idea-decisions.md, §4 "The front door — added 2026-08-23" (both fragments verbatim from the same quote) -->

## Every claim points at a line

Each knowledge file is cut into chunks with ids like `nokia:quarter-end-close`.
The model is told to end every sentence that states a fact about me with the
id of the chunk it came from.

<!-- source: docs/roadmap.md, "Sprint 3 results", item 1 ("The id lives on the line above the text it names"); lib/system-prompt.ts, "## Citing"; lib/chunks.generated.ts as built by scripts/build-knowledge.mjs (the id nokia:quarter-end-close) -->

Then code checks it. After the answer arrives, `lib/verify.ts` takes each
sentence that contains a number or a proper noun, opens the chunk that sentence
cited, and looks for those numbers and names in it. No second model is
involved. The published prompt tells the model as much: "This is a string
comparison, not a second opinion — it can't be persuaded."

<!-- source: lib/verify.ts, header comment; docs/sprint-3-grounding.md, "What ships" (#21) and constraint 4 ("No model call, no network, no dependency"); lib/system-prompt.ts, "## Citing" (verbatim; rendered at /prompt) -->

A sentence whose fact is elsewhere in the record is marked "miscited," one
whose fact is nowhere is "unverified," and one that cites nothing is
"uncited." Across 13 published live runs on eight model versions, no answer has
cited an id that doesn't exist. "Verified" stays a narrow word: the numbers and
names in that sentence appear in the chunk it cited. A sentence can pass and
still be wrong.

<!-- source: lib/verify.ts, type ClaimVerdict and header comment ("`verified` means exactly that, which is narrower than 'true'"); evals/published/latest.json (13 live runs, inventedIds 0 in every run); docs/roadmap.md, "Sprint 3 results", item 5 -->

Most of the work was calibration. Every false alarm a live run produced, from
"First," read as a proper noun to "March" checked against "Mar 2026", is now a
test. The checker leans toward under-reporting, because a mark on a correct
sentence teaches people to ignore every mark.

<!-- source: docs/roadmap.md, "Sprint 3 results", items 2 and 3; app/measurements/page.tsx, COPY (the calibration paragraph) -->

So the title overstates it a little. The assistant can still be wrong. What it
can't do quietly is claim a number or a name my record doesn't contain: the
checker marks it beside the sentence.

<!-- source: lib/verify.ts (verdicts; only "unverified" gets the accent); docs/roadmap.md, "Sprint 7 results", item 5 (a sentence whose proper nouns are all present can still be wrong) -->

## Selling me, until a role is on the table

Early on, I had to decide whose side the assistant is on: "you're working for
me on this site, no? Try to sell me. But obviously I don't make sense as a
Staff Engineer at Meta."

<!-- source: docs/idea-decisions.md, §4 "Honesty and advocacy — where each belongs" (verbatim; the quote's first sentence is trimmed) -->

The rule that came out of it: advocate by default, and be plain about gaps when
a specific role is on the table. In open chat the assistant makes the best case
the evidence supports. When someone pastes a job posting, a real mismatch would
come up in an interview anyway, so it names the requirements I don't meet. A
brainstormed page making "the case against hiring me" was turned down for this
reason: "I don't want this to turn into a horror story like 'he was about to
get this job, but his AI agent said he wasn't a good fit.'"

<!-- source: docs/idea-decisions.md, §4 "Honesty and advocacy" (policy and its reasoning) and §2, "The case against hiring me" (verbatim quote); lib/refusals.ts, entry "case-against" -->

The posting flow is where the controls are tightest. The model extracts the
requirements word for word, judges each one, then writes a summary, and
`lib/role-fit.ts` decides what a reader sees. Every extracted requirement gets
a row, whether or not the model judged it. A row that claims "met" or "partial"
and cites nothing valid is downgraded to "unclear," and the table says code
made the change. The gaps list can't come back empty while any row is unmet.

<!-- source: docs/roadmap.md, "Sprint 4 results" ("a job-posting turn is three forced steps"; what lib/role-fit.ts decides); lib/role-fit.ts, header comment, rules 1–4; lib/refusals.ts, entries "uncited-fit" and "silent-gaps" -->

> **Figure 2 goes here.** Brief below: the fit table on a real-shaped posting.

The first measurement of this flow found a different bug from the predicted
one. Gap-naming was fine. The failure was that on the postings I'm least
qualified for, the model skipped the assessment tool and answered in prose, so
there was no structured verdict where it mattered most. Forcing the tool call
fixed that, and extracting the requirements before judging them stopped models
from skipping one.

<!-- source: docs/idea-bank.md, §6 "The diagnosis", "Stage 0 results — first run, 2026-07-27" and "Stage 0 follow-up — 2026-07-27, roadmap Sprint 1"; docs/roadmap.md, "Sprint 1 results" and "Sprint 4 results", item 2 ("Coverage is what fixed gap-naming") -->

In October I had the summary lead with my strongest matches instead of a
grade. It still can't state a row more strongly than its verdict, and it still
names every unmet requirement. On a GTM systems posting written for the test,
the verdict read: "Strongest matches are ambiguous-work ownership, forecasting
and quarter-end reporting; the role's core Salesforce administration, lead
routing and CPQ are outside the record." The rows didn't get kinder. Runs on
that posting came back with six or seven unmet rows, against four or five
before the change.

<!-- source: docs/followups.md, "The summary, strengths first, 2026-10-19 — Sidhant's call" (the policy, the "After" verdict quoted verbatim, and "Every run after the change had 6 or 7 unmet, against 4–5 at `low` before it"); content/knowledge/projects-nokia.md, "Reporting" ("His Salesforce work is reports and dashboards in CRM Analytics, not administration") -->

## Measuring it, and knowing when not to

The eval suite has two layers. The static one is close to 500 checks that run
on every change with no API key. The live one sends 22 fixed cases to a running
server (factual questions, off-topic requests, prompt injection, job postings)
and grades the answers with string checks. Its README calls that "a regression
net, not a quality score": a wrong answer containing the right number still
passes.

<!-- source: evals/README.md (two layers; groups; "They are a regression net, not a quality score"); static count: 497 tests (496 pass, 1 skipped) when the suite was run for this draft on 2026-11-02, and 479 in the published snapshot of 2026-10-20 (evals/published/latest.json); 22 cases: docs/followups.md, "The bake-off, 2026-10-20" -->

The measurements page is built to hold back numbers it can't stand behind. The
first published run had six checkable claims, three of them verified. Printing
"50%" would have been the most misleading figure on the site, so the page
withholds a rate below twenty claims and shows the counts.

<!-- source: docs/roadmap.md, "Sprint 6 results", item 3 ("The honest number was the one it refused to print"); lib/refusals.ts, entry "small-sample" -->

The October model comparison ran every case on every model the site offers,
and it turned up a reconciliation problem. Each run's list-price estimate was
checked against what the AI Gateway billed. Five of six matched to within a
hundredth of a cent. DeepSeek billed 3.3 times its headline rate, the risk the
site had already flagged: many providers serve it at different prices, and the
site doesn't pin one. On a list-price chart it looked second-cheapest; billed,
its run cost five times the default's.

<!-- source: docs/followups.md, "The bake-off, 2026-10-20 — what the Gateway billed" (table, "Five of six matched", "3.3 times", "five times Luna's", "second cheapest"); docs/followups.md, "Update 2026-10-19", item 2 (fifteen providers; "The route pins no provider") -->

> **Figure 3 goes here.** Brief below: list price against billed, per run.

Every failure in that comparison was read, and most were the grader's mistakes.
The measurements also changed how the site runs: setting the default model's
reasoning to "low" on posting turns brought the fit table for a long posting in
at 13 to 14 seconds instead of 28 to 33, with the same requirements extracted.

<!-- source: docs/followups.md, "The bake-off, 2026-10-20" ("Every failure was read, and most are the grader rather than the model"); docs/followups.md, "Reasoning on posting turns, 2026-10-19 — low for Luna" ("The card arrived in 13–14 s instead of 28–33 s"; "Every run extracted the same requirements") -->

## How it got built

Most of the code was written by AI agents in Claude Code, working from specs I
signed off on. [VERIFY: is "most" right, and what did you do by hand? The colophon's draft says "Most of the code was written by AI agents working from a build spec. I made the decisions", but that sentence is Claude's draft too.] Four models
brainstormed features. I went through their lists by voice, kept 28 items, and
logged the rest as rejected so they wouldn't come back. A roadmap ordered the
28 into seven sprints and a parallel copy track, with acceptance criteria.
Sprints were specced one at a time, with one agent per item, and each ended
with a results note that has a section called "Not done, and out of scope by
design." [VERIFY: the roadmap dates the plan and all seven sprint results 2026-07-27. Was that one day of agent work? If so, say it plainly; if not, give the real span.]

<!-- source: docs/portfolio-build-spec.md, §5 ("1–2 sessions with Claude Code"); app/colophon/page.tsx (draft wording, logged in docs/copy-ledger.md); docs/followups.md, §4 ("A four-model brainstorm (Haiku, Sonnet, Opus, Fable)"); docs/idea-decisions.md, intro ("dictated in voice mode", "28 items") and §2 ("Recorded with the reason so they don't get re-proposed"; several reasons are just "No."); docs/roadmap.md, status line, "The shape" (Track A and Track B), "How the work gets specced" ("Per sprint, at the point we start it"; "One agent per item"), and the "Not done, and out of scope by design" paragraph closing each of Sprints 1–7 -->

Copy got the same treatment. I let the agents draft text so I could see pages
whole, on one condition: "I don't want AI misrepresenting my experience
somewhere, I just need to be able to review all the content." Every drafted
string goes in a ledger that says whether it makes a factual claim. A fact about
me has to trace to the resume or the knowledge files or carry a VERIFY marker,
and the build fails if a marker reaches a rendered page.

<!-- source: docs/idea-decisions.md, §4 "Copy — the never-write rule is replaced by a ledger" (verbatim quote); docs/copy-ledger.md, "How to use this file" (the Claims column); CLAUDE.md, "Copy", conditions 1–3; scripts/check-rendered-markers.mjs (postbuild) -->

In October an overnight builder-and-critic loop went over the whole site for a
RevOps or delivery ops reader. Builders worked in parallel lanes, and a
separate critic scored each page blind. An auditor checked about 115 rendered
claims against the knowledge files. Every number and date held. The scope
didn't: "the systems" for one app and one migration, "teams run on" for tools I
built, a page title implying a delivery ops job. All of it was fixed the same
hour. The checker now reads the site's hand-written copy too, so a number that
stops appearing in the knowledge files fails the test suite.

<!-- source: docs/gauntlet-log.md, intro ("started 2026-10-22 while Sidhant slept"), "Goal", "Round 1 — wave 1 builders" ("Five lanes in parallel, each in its own worktree"), "Round 1 critique — Fable, blind, plus an independent fact audit" (the ~115 claims, the scope list, "All fixed the same hour"); docs/roadmap.md, "Track B results — 2026-07-27", item 1 (lib/verify.ts run over the recruiter copy) -->

## Why this is the RevOps job

I'm a sales operations specialist at Nokia. I launched the self-serve Power App
behind quarter-end executive reporting for 80+ stakeholders across 7 regions,
replacing an error-prone, full-day manual consolidation. I run the sales
incentive calculations for 900+ staff. I'm building an AI agent that flags
pipeline gaps against prior years, conflicting fields and past-due dates; it's
in testing and has no results yet. Before that, in workforce management, I
automated the input checks on the monthly headcount forecast with VBA, which
saved about five hours a week of manual review.

<!-- source: content/knowledge/resume.md, "Nokia" (sales operations specialist and workforce management bullets); content/knowledge/projects-nokia.md, "Quarter-end close", "What he inherited", "The AI agent, in testing", "Workforce management" -->

[VERIFY: the next paragraph is framing, not a fact. Is this how you'd connect the two? Rewrite freely.]

That work and this site run on the same habit. A number should be traceable to
where it came from before anyone acts on it. The check should run in code, so
it holds on the day nobody is looking. A figure from too small a sample should
be held back, and a gap should be named while it's still cheap to talk about.
A revenue team needs that from its forecast and its commission runs, and it's
what I built this site to do with claims about me.

<!-- source: drafted framing, for Sidhant to confirm or rewrite. Supporting facts: content/knowledge/resume.md (Nokia bullets); docs/roadmap.md, "Sprint 6 results", item 3; lib/refusals.ts (five rules "enforced by code") -->

## What it still can't do

The checker reads numbers and proper nouns, nothing else, so a sentence whose
names are all in the record can still be wrong. A sentence listing what I lack
can still get marked "unverified," because the filter that skips gap sentences
misses some phrasings. The latency panel has never shown a number, because it
has no production analytics to read yet. And the checker compares answers with
my record, so a mistake in the record would come back looking verified.

<!-- source: docs/roadmap.md, "Sprint 7 results", item 5; docs/followups.md, "The bake-off, 2026-10-20" ("gap sentences that f7d7439's gap-clause filter does not recognise"); app/measurements/page.tsx, COPY ("a sentence that only names a gap isn't checked any more"); docs/roadmap.md, "Sprint 6 results", "Not done" (#23 "has never rendered a number"); docs/your-turn.md, §6; lib/verify.ts, header comment -->

## Try it

The site is sidhantmathur.com. Ask it something you'd ask on a call, or paste a
job description and see what it says I'm missing. The full system prompt is at
/prompt and the eval results are at /measurements. /refusals lists what the
assistant won't do and what holds each rule: five are enforced by code, five
are asked of the model, and one is a decision I made. [VERIFY: link the source repo? Its visibility is unconfirmed for this draft. The ledger's pending table says the repo and docs/ are public, and that linking it is your decision.]

<!-- source: app/prompt/page.tsx, app/refusals/page.tsx, app/measurements/page.tsx; lib/refusals.ts (11 entries: enforcedBy "code" ×5, "prompt" ×5, "decision" ×1); docs/roadmap.md, "Sprint 7 results", item 6; docs/copy-ledger.md, "Pending `[VERIFY]` markers" (the colophon row on linking the repo) -->

---

## Figure briefs

### Figure 1: the empty turn, then and now

**What to capture.** Two panels side by side. Left: the smoke test's row for
the default model on the RevOps chip, typeset as a small table (model
`deepseek-v4-flash-0731`, output 600 of 600 tokens spent reasoning,
`finishReason: length`, rendered: nothing). Right: a screenshot of what the site
shows now when a turn finishes empty. To get it without spending a model call,
open `https://sidhantmathur.com/?simulate=empty_answer`, click "Is he a fit for
a RevOps role?", and capture the "no answer" state with its "try again" and
"ask … instead" buttons. Desktop width, dark theme.

**Why.** The opening's point in one image: the same failure, silent and then
visible. Don't reconstruct the old green light. It was removed from the header
on 2026-10-22, so a "before" screenshot would be staged; the table row is the
real record of it.

Sources: `docs/followups.md`, "Smoke test, 2026-10-19"; `app/api/chat/route.ts`
(the `simulate === "empty_answer"` branch, which calls no model);
`components/shell/use-conversation.ts` (forwards `?simulate=` to the endpoint);
`docs/gauntlet-log.md`, "Decided 2026-10-22", item 5.

### Figure 2: the fit table on a real-shaped posting

**What to capture.** Paste the "GTM Systems Manager, Revenue Operations"
posting, which `docs/followups.md` reproduces verbatim under "Reasoning on posting
turns", into the job-description form on the live site. Capture the full
requirement table: the met / partial / unmet counts, a few rows with their
cited sources, the gaps list, and the one-line verdict above it. Then open one
cited chunk in the side panel and capture that too, so a reader can see a row
point at a line of the record. If a row shows a code downgrade ("unclear", with
the note that the site changed it), make sure it's in frame; don't edit
anything to produce one.

**Why.** This is the picture a hiring manager remembers: every requirement has
a row, the gaps are listed plainly, and each claimed match points at the record.
It carries the section's argument better than the prose does.

**Check before publishing.** The table will name your gaps for a mainstream
GTM systems role (Salesforce administration, lead routing, CPQ, per the
2026-10-19 runs). That's the feature working, but it's your call whether this
is the posting to show.

Sources: `docs/followups.md`, "Reasoning on posting turns, 2026-10-19" (the
posting) and "The summary, strengths first"; `lib/role-fit.ts`.

### Figure 3: list price against billed, per run

**What to capture.** A chart built from the table in `docs/followups.md`, "The
bake-off, 2026-10-20". One row per run (six runs), two values per row: list
price and billed. Paired dots on a shared horizontal dollar axis work best,
direct-labelled with the model name, with the DeepSeek pair annotated "3.3×"
(list $0.0113, billed $0.0368). Use the site's palette: billed in the accent
(`#E4522B`), list price in `--text-faint` (`#97918A`), hairline grid, no legend.
Caption: the billing key is shared with production, so each billed figure is an
upper bound.

**Why.** It's a reconciliation, which is RevOps work, and it shows the
measurement habit better than a sentence can: five runs land on top of their
estimate and one doesn't. *Alternative if you'd rather show speed:* the
fit-table arrival times from "Reasoning on posting turns", default (28.3,
32.5, 29.4 s) against `low` (13.1, 14.0, 14.2 s) on the long posting.

Sources: `docs/followups.md`, "The bake-off, 2026-10-20"; palette from
`docs/sprint-8-model-comparison.md`, "Palette".

---

## LinkedIn version (~150 words)

In October, a smoke test of my portfolio's chatbot found five of 35 answers
coming back blank, behind a green status light. One of them was the question I
most needed it to answer: whether I'm a fit for a RevOps role.

It's fixed, and the fix sums up how the site works. The assistant answers only
from my resume and a few knowledge files. Every factual sentence cites the
chunk it came from, and code checks that the numbers and names are really
there, without asking another model. Paste a job description and every
requirement gets a row; a claimed fit with no citation is downgraded
automatically. The eval results are published, and the page holds back any
rate with too small a sample behind it.

It's the same work I do in sales operations at Nokia: checks that run in code,
numbers you can trace, gaps named early.

Write-up: [link]. Ask it something: sidhantmathur.com

<!-- source: as the post above (docs/followups.md smoke test; lib/verify.ts; lib/role-fit.ts; docs/roadmap.md Sprint 6 item 3; content/knowledge/resume.md). The last paragraph's framing needs Sidhant's sign-off, same as "Why this is the RevOps job". -->

## Two-sentence pitch

I built a portfolio chatbot that answers questions about my career only from my
resume, cites the line behind every factual sentence, and has code check each
citation, then published its eval results, including the rates it won't print
from too small a sample. [VERIFY: framing] It's the same discipline I bring to
sales operations at Nokia: numbers you can trace, checks that run in code, and
gaps named before anyone acts on them.

<!-- source: lib/verify.ts; docs/roadmap.md, "Sprint 6 results", item 3; content/knowledge/resume.md -->

---

## Open points for Sidhant

1. Your reaction to the blank answers (opening section). Not recorded anywhere.
2. Who ran the smoke test, the comparison and the reviews: you or an agent.
   Change the passive sentences to "I" where it was you.
3. "Most of the code was written by AI agents in Claude Code": confirm, and say
   what you did by hand.
4. The 2026-07-27 dates on all seven sprints: one day, or a longer span?
5. The RevOps framing paragraph and the pitch's second sentence: your view or
   not.
6. The first-person decisions ("I had the summary lead with my strongest
   matches", "I went through their lists by voice") come from docs that record
   them as your calls. Check that the wording matches how you'd describe them.
7. Whether to link the repo. This draft treats its visibility as unconfirmed.
8. Whether Figure 2 should show a posting where the table names your Salesforce
   administration and CPQ gaps.
9. The Meta line in your quote: keep it or trim the quote after "Try to sell
   me."
10. The title: keep the working title (the body corrects it) or use one of the
    two alternatives in the notes at the top.
