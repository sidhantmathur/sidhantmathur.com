# Copy ledger

Every string on the site that Claude drafted rather than Sidhant writing, so it can
all be reviewed in one pass. Established 2026-07-27, replacing the old
never-write-copy rule in `CLAUDE.md`.

**The deal:** placeholder copy gets drafted so pages can be seen whole, but nothing
goes unlogged and nothing invents a fact about Sidhant's experience.

## How to use this file

Add a row when you write any user-visible string. Sidhant reviews in batches and
moves rows to **Approved** or rewrites them.

Status values:

- `draft` — written by Claude, unreviewed. The default.
- `approved` — Sidhant read it and kept it (possibly edited).
- `sidhant` — Sidhant wrote it from scratch. Logged so the ledger is a complete
  picture, not just an AI-output list.
- `removed` — taken off the page. The row records what came off and why, so a
  string that disappeared is as visible as one that was added.

The **Claims** column is the one that matters:

- `none` — voice, labels, microcopy, error states. No assertion about Sidhant.
- `factual` — asserts something checkable about his experience, skills, or work.
  **Every factual row must trace to `content/knowledge/` or the resume.** If it
  can't, it should not have been written — use `[VERIFY]` inline instead.

## Ledger

| Status | Where | String / summary | Claims | Source |
| --- | --- | --- | --- | --- |
| draft | `components/shell/shell-data.ts` → `IDLE_LINES` | Six idle-mode one-liners that type themselves out after 90s of no input. "Still here. These lines ship with the page…" · "The knowledge base rides inside the prompt, byte for byte…" · "No tokens are moving. The needle is at rest." · "The message budget refills on a sliding hour…" · "Most of the rail has a real page underneath it. Cmd-click and see." · "Ask the question you'd actually ask on a call." | none | Site behaviour — see the note below |
| draft | `components/shell/instruments.tsx` → cost meter | "Estimated at published list price. The knowledge base is byte-identical on every request, so once it is cached that part of the input bills at a fraction of the fresh rate — the saving is the line above." | none | `lib/pricing.ts`, `lib/system-prompt.ts` |
| draft | `components/shell/instruments.tsx` → cost meter | "Nothing you type is stored on the server. The conversation lives in this browser until you clear it from the front page, and the only thing kept server-side is a per-IP counter for the hourly limit." (was "until you reset it", 2026-10-19: the strip's reset is gone; "clear" is on the front page's continue row.) | none | `use-conversation.ts` (localStorage), `route.ts` (Upstash) |
| draft | `components/shell/instruments.tsx` → cost meter | "No list price on file for {model}, so its turns are left out of the total rather than estimated." | none | `lib/pricing.ts` |
| draft | `components/shell/instruments.tsx` → rate | "The live needle is sampled from the text as it arrives and marked ≈. The number without one is the server's own measurement of the last finished turn." | none | `use-token-rate.ts` |
| draft | `components/shell/instruments.tsx` → trace | "Nothing yet. Ask a question and every number behind the answer lands here." and "Two latencies on purpose: the server measures the model, the browser measures the wait. The gap between them is the network." | none | `lib/chat-telemetry.ts` |
| draft | `components/shell/instruments.tsx` → failure theatre | Intro ("Every way this site can fail, on demand…") plus one `cause` sentence for each of the eight error classes. | none | The error-class doc comments in `lib/chat-telemetry.ts` and the exits in `route.ts` |
| draft | `components/shell/instruments.tsx` → sound | "A tick per chunk of text, pitched to how fast it's arriving. Synthesized in the browser, off until you switch it on, and remembered after that." | none | `use-teletype.ts` |
| draft | `components/shell/answer.tsx` → downgraded claims | The two verdict labels and their explanations: "unverified · {tokens} — not in {chunk id}" · "uncited · no source cited for "{sentence}"" · "cited {id}, which isn't a source on this site" · "and {n} more like it." | none | `lib/verify.ts` — each string restates that function's output |
| draft | `components/shell/answer.tsx` → uncited answers | "no sources cited · this answer doesn't point at a specific part of the record." Shown once, in place of per-sentence marks, when an answer cites nothing at all. | none | `lib/verify.ts` |
| draft | `components/shell/panel-body.tsx` → requirement table | The row-level marks and their explanations: "cited no source — downgraded from {verdict}" · "the assessment didn't answer this one" · "the assessment restated this one without judging it" · "unverified · {tokens} — not in {chunk ids}" · "cited {id}, which isn't a source on this site" | none | `lib/role-fit.ts` — each string restates one branch of the reconciler |
| draft | `components/shell/panel-body.tsx` → requirement table | Section labels: "What he doesn't have" (over `gaps`) and "No unmet requirements — why" (over `noGapsRationale`). | none | `lib/role-fit.ts` |
| draft | `components/shell/panel-body.tsx` → requirement table | The closing note: "Each row is a judgment against the record, not a score, and the four tags don't add up to one. A row claiming a fit has to name the part of the record it stands on; where it didn't, the site downgraded it rather than the model." | none | `lib/role-fit.ts`, and decisions §3's rendering constraint |
| draft | `components/shell/instruments.tsx` | Instrument labels and section titles — "Cost", "Rate", "Trace", "Failure theatre", "Sound", "session cost", "saved by the cache", "what came over the wire", etc. UI affordances rather than prose, logged as one row. | none | — |
| draft | `components/shell/app-shell.tsx` → `REPLAY_BANNER` | Shown at the top of a conversation opened from a permalink: "Replayed conversation. It was rebuilt from the link you opened — the site stored nothing, and this is a snapshot of what the model said then, not a live session." Plus the "start a fresh one" button under it. | none | `lib/permalink.ts` (the fragment is the transport), `use-conversation.ts` (a replay is never persisted) |
| draft | `components/shell/export-deck.tsx` → `EXPORT_COPY` | The eight strings in the export panel: the empty state ("Ask something first — there's nothing to export yet."), and one explanation each for markdown, print ("…“Save as PDF” there gives a typeset document with working links — not a screenshot of this page."), the link ("…compressed into the part of the URL after the #, which browsers never send to a server. There is no database: the link is the storage."), the link caveat ("It is encoding, not encryption — anyone holding the link can read the conversation — and it is frozen at the moment you made it."), the over-length warning, the unsupported-browser line, the scorecard, and the mail draft. | none | `lib/permalink.ts`, `lib/transcript.ts`, `app/globals.css`'s print block — each string restates one of them |
| draft | `components/shell/export-deck.tsx` | Section and button labels — "Markdown", "Print", "Link", "Scorecard", "copy the conversation", "download .md", "print / save as PDF", "build a link", "rebuild the link", "copy the link", "copy the scorecard", "open a mail draft", "{n} characters". UI affordances rather than prose, logged as one row. | none | — |
| draft | `components/shell/shell-data.ts` → `FIT_LABELS` | Two new labels over the assessment, used by the scorecard export and the print document: "Coverage" (over the verdict counts) and "Strongest evidence" (over the cited rows). The other three (`gaps`, `noGaps`, `notAScore`) are the existing panel strings, moved here so one field isn't called two things in two artifacts. | none | `lib/role-fit.ts` |
| draft | `components/shell/shell-data.ts` → `SLASH_COMMANDS` | Hints for the four commands added in Sprint 5: "/jd — Paste a job description", "/budget — Turns, tokens and what they cost", "/sources — Every source the answers are built from", "/pdf — Export — markdown, print, link". | none | The panel each one opens |
| draft | `components/shell/app-shell.tsx` → actions strip | The persistent action labels: "copy", "export", "link" (becomes "link copied"), "paste a job description". UI affordances rather than prose. "reset" was removed 2026-10-19; see the `removed` row for it below. | none | — |
| draft | `app/measurements/page.tsx` → page frame | Title "What this assistant scores", the metadata description, and the three opening paragraphs: what the page is ("Every instrument on this site measures one conversation — yours…"), how fresh it is ("…aggregated when the site is built, so they are exactly as old as the last deploy…"), and the honesty rule ("Where a figure is derived, drawn from a small sample, or not measured at all, it says so beside itself…"). | none | `scripts/build-measurements.mjs` — each sentence restates what that script does |
| draft | `app/measurements/page.tsx` → eval suite | The section intro describing the two eval layers, the live-runs intro, the two empty states ("No run has been published yet…", "No live run has been published yet."), and the two notes — that the static layer is assertions rather than questions asked of a model, and that a turn which failed in transport is counted separately from one the model answered badly. | none | `evals/README.md`, `evals/run-live.mjs` (the `BROKE` path from Sprint 1's finding 2) |
| draft | `app/measurements/page.tsx` → latency and reliability | The section intro, one sentence per reason the aggregate can be missing ("This build had no analytics credentials…" · "The analytics store answered and holds no chat turns in the window… this page cannot tell you which, so it will not guess." · "The analytics query failed while this site was being built…"), and the note that time to first token excludes the network to the browser. | none | `lib/chat-telemetry.ts` (the `ttftMs` doc comment), `scripts/build-measurements.mjs` |
| draft | `app/measurements/page.tsx` → groundedness | The section intro describing the checker, the narrowness paragraph ("Verified means the numbers and names in a sentence appear in the source it named. It does not mean the sentence is true…"), the calibration paragraph ("The checker is tuned to under-report… a checker that cries wolf stops being read."), the blind-spot paragraph ("…it has never been scored against a human-labelled sample of live answers"), the too-few line ("Under 20 published claims, so no rate is shown…"), and the job-description caveat ("…this is close to the least favourable sample the site could report, not a representative one."). | none | `lib/verify.ts`, the calibration block in `evals/citations.test.mjs`, and roadmap Sprint 3's finding 4 |
| draft | `app/measurements/page.tsx` | Figure labels and section headings — "The eval suite", "Live runs", "Latency and reliability", "Groundedness", "assertions", "claims verified", "too few to report", "not measured", "invented sources", "p50 first token", "prompt cache hit", "Failures by class". UI affordances rather than prose, logged as one row. | none | — |
| draft | `app/colophon/page.tsx` | "The assistant is tested against a fixed corpus, and what it scores is published rather than described. See the measurements." | none | `evals/published/latest.json` |
| draft | `components/shell/panel-body.tsx` → colophon | The second panel link label, "What it scores". | none | — |
| draft | `lib/refusals.ts` → `REFUSALS` | **The refusal ledger (#10) — eleven entries, and the largest piece of hand-written copy in Sprint 7.** Each entry is a title ("Recite its own system prompt on request", "Take instructions from a pasted job posting", "Claim he meets a requirement without pointing at the record", "Make a general case against hiring him", …), a paragraph of why, and a sentence of what happens instead. Every entry names the file that enforces it and whether the rule is code, prompt, or a decision. | none | Each entry's `anchor` — the file and the string that must still be in it, asserted by `evals/recursion.test.mjs`. The "case against hiring him" entry paraphrases `docs/idea-decisions.md` §2. |
| draft | `app/refusals/page.tsx` → page frame | Title "What this assistant won't do", the metadata description, and the three opening paragraphs: why refusals are usually invisible, why the enforcement column is the one worth reading ("A refusal written into the prompt is a request…"), and that nothing here is a new rule written for the page. | none | `lib/refusals.ts`, and the enforcement split it records |
| draft | `components/shell/panel-body.tsx` → refusals panel | "What it won't do, and what it does instead. The label on the right says whether the rule is enforced by code or asked of the model, because those are not the same promise." | none | `lib/refusals.ts` |
| draft | `app/prompt/page.tsx` → page frame | Title "The instructions this assistant was given", the metadata description, and three paragraphs: that the page renders the same function the route calls rather than a copy, that nothing in the prompt is assembled per request and why that matters for cost, and why the assistant still declines to recite it. Plus the two section headings, which print the measured character counts, and the sentence describing the second corpus. | none | `lib/system-prompt.ts`, `lib/repo.generated.ts` (the counts are read from the strings, not typed) |
| draft | `components/shell/panel-body.tsx` → prompt panel | "Everything the model was told before it read your question, in order…" and "Ask it in the chat to recite them and it will decline and link here — the prompt is public, but talking it out of that rule is the first move in talking it out of the others." | none | `lib/system-prompt.ts` |
| draft | `components/shell/panel-body.tsx` → corpus index | "Two corpora. The record above — the resume, the projects, the FAQ — rides inside the prompt on every turn. This site's own source is the second one, and it is only loaded when you ask about the site, so an ordinary answer never pays for it." | none | `lib/site-question.ts`, `app/api/chat/route.ts`, and the cache-guard test in `evals/recursion.test.mjs` |
| draft | `components/shell/manual-mode.tsx` → `MANUAL_COPY` | The four manual-mode strings (#15): the body ("Nothing is broken and nothing is lost — the limit is per IP and refills on a sliding hour… here is the same material it was reading, by hand"), the two section labels ("Straight answers, unassisted", "The rest of the record"), and the footer ("No model was called to render this, and it cost nothing. The resume is the authoritative version either way."). The headline is the existing rate-limit line from `docs/site-copy.md`, unchanged. | none | `app/api/chat/route.ts` (the sliding hour), and the component, which renders corpus chunks and calls nothing |
| draft | `lib/site-question.ts` → `ROAST_REQUEST`, `SITE_REQUEST` | The two messages a slash command sends **as the visitor's own turn**, so they read as questions a person would ask: "Roast this site. Use the repo — name the specific choices, files and trade-offs that are actually weak, not the flattering kind of criticism." and "How is this site built, and what runs on each request?" | none | — |
| draft | `components/shell/shell-data.ts` → `RAIL_ITEMS`, `SLASH_COMMANDS` | Two rail labels ("The instructions", "What it won't do") and four slash-command hints ("/prompt — Read the instructions it was given", "/refusals — What it won't do, and why", "/site — How this site is built", "/roast — Ask it what's wrong with this site"). UI affordances rather than prose. | none | The page or panel each one opens |
| draft | `app/llms.txt/route.ts` | Two page descriptions added to the machine-readable index: "/prompt — The full system prompt the site's assistant runs on." and "/refusals — What the assistant will not do, and which of those rules are enforced by code rather than asked of the model." Plus the existing `/measurements` line, which was missing. | none | The pages themselves |
| draft | `lib/system-prompt.ts` → the site sections | **Model-facing, not screen-facing, but it changes what visitors are told.** A "## This site" section making the site's own construction in scope, a rule that criticism "never becomes a criticism of Sidhant", the decline-and-link line pointing at `/prompt`, and the appended block's rules for citing `repo:` ids and roasting specifically. | none | `docs/idea-decisions.md` §2 and §4; `scripts/build-repo-corpus.mjs` |
| draft | `content/recruiter.ts` → `RECRUITER_TLDR` | **The recruiter TL;DR (#25) — the highest-risk rows in this ledger, and the only ones that make factual claims about Sidhant.** Six labelled lines in the homepage's empty state: `now` ("Sales operations specialist at Nokia, in Toronto. Co-founder and CTO of A Darle 20.") · `shipped` ("A Darle 20 — a two-sided marketplace, architected and shipped solo. 1,400+ registered users, 127 hosts and 2,100+ bookings in its first four months.") · `before that` ("At Nokia: a self-serve Power App used by 80+ stakeholders across seven regions, and a Salesforce Analytics to Power BI migration for 150+ users.") · `how he builds` ("An AI-agent-heavy workflow in Claude Code — agents write most of the code, he keeps architecture, code review and release.") · `looking for` ("A RevOps / GTM systems role at an AI-forward company.") · `where` ("Toronto, ON. Canadian citizen, no visa sponsorship needed."). | **factual** | Each row carries a `source` field naming the corpus file it came from — `bio.md`, `resume.md`, `projects-nokia.md`, `projects-adarle20.md`, `faq.md`. See the note below: the suite checks each row against that file with `lib/verify.ts`. |
| draft | `content/recruiter.ts` → `TLDR_LABEL`, `TLDR_FOOTER` | The block's label ("tl;dr") and the link under it ("The resume has the rest, and so does the box below."). | none | — |
| draft | `content/recruiter.ts` → `SUGGESTED_QUESTIONS` | **The recruiter chips (#26), replacing the previous three.** "Give me the 30-second version" · "What has he shipped end to end?" · "Is he a fit for a RevOps role at an AI-forward company?" · "Does he need visa sponsorship?" The third is also what `/fit` sends. | none | They are questions, not assertions — but two presuppose: "shipped end to end" (`resume.md`, "architected and shipped the entire marketplace") and the RevOps framing (`faq.md`, "RevOps / GTM systems roles at AI-forward companies"). Both hold. |
| draft | `content/adarle20.mdx`, `content/nokia.mdx`, `content/dell-ml.mdx` → "In plain terms" | **The explain-like-I'm-five prose (#20).** One section per case study — at the head of the Dell page, and since 2026-10-19 below the results on the Nokia and A Darle 20 pages (see "The case studies, reworked for RevOps" below) — two paragraphs each, in plain language with no stack names and no figures: A Darle 20 ("Tabletop roleplaying games are played in groups… The booking form is the easy part. The hard part is money."), Nokia ("A large company sells in a lot of places, and every quarter its executives need one picture of how that went…"), Dell ("A propensity model is a way of ranking that list… it was an internship, the model was one piece of a much larger sales machine, and the pipeline figure below is an estimate"). | none | Restatement only. Every claim in them is already in the section below it, in `docs/site-copy.md`; the suite asserts these sections contain **no numeral at all**. |
| draft | `content/adarle20-media.ts` → `FEATURE_SURFACE` | **The A Darle 20 feature surface (#19).** Six groups and their items: Discovery (host profiles, session listings) · Booking (bookings and reservations, cancellations, automated refunds) · Payments (Stripe Connect, host payouts, platform fees, OXXO cash payments at a convenience store) · Communication (real-time chat, transactional email on Resend) · Accounts (authentication) · Operations (end-to-end funnel instrumentation — bookings, conversion, cancellations, refunds, host activation). Plus the section heading "Everything in it" and its intro. | **factual** | `content/knowledge/projects-adarle20.md` and `content/knowledge/resume.md`. Every item is checked against those two files by `lib/verify.ts` in the suite. Nothing was added because a marketplace probably has it. |
| draft | `content/adarle20-media.ts` → `FEATURE_SURFACE_NOTE` | "This list is everything the written record names, which is not the same as everything the product does — [VERIFY: the features that exist in A Darle 20 but appear in no source file…]" | none | The gap is stated rather than filled. Listed in the pending table below. |
| draft | `content/adarle20-media.ts` → `ADARLE_MEDIA` | **The media surface (#19) — seven slots, one filled.** Each slot's title and its `brief`, which is the on-page placeholder text: "Session listings" (filled), "Booking a seat, end to end", "Paying in cash", "What a host sees", "Host and player chat", "The funnel, instrumented", "The 251-player event". The briefs describe what the file must show, in the imperative, to Sidhant. | none | The briefs assert nothing about Sidhant or the product — they are requests. The one filled slot's `alt` and caption were written from the file itself (`public/images/adarle20-listings.png`), not from a description of it. |
| draft | `components/project-media.tsx` | **Retired in wave 1 (2026-10-19) except the heading — see below.** The frame chrome: "What it looks like", "Nothing here yet — waiting on a {kind}.", "{title} — not captured yet.", and the intro ("Frames with nothing in them are waiting on a file. Each one says what it is for rather than showing a stand-in, because a placeholder that looks like a product is a claim about a product."). | none | The component itself — each string describes the state it renders. |
| draft | `components/shell/app-shell.tsx` → mobile controls | Affordance labels added with the mobile pass: the "↓ PDF" chip beside the resume citation, and the "Send" / "Open navigation" screen-reader labels on the two icon buttons. UI affordances rather than prose, logged as one row. | none | `public/resume.pdf` |
| draft | `app/measurements/models/page.tsx` → page frame | Title "Five models, one corpus", the metadata description, and the two opening paragraphs: what was run ("This site can run five models behind one chat endpoint… the same 22 questions, in the same order, against the same server, on the same afternoon") and why ("The point is not to crown a winner. It is that a model choice is a trade between four things that pull against each other…"). Plus the dated-artifact line and the empty state ("No live run has been published, so there is nothing to compare…"). | none | `evals/published/latest.json` — the run dates, model list and case counts are read out of the snapshot, not asserted |
| draft | `app/measurements/models/page.tsx` → section intros | The headings and intros for the two frontier charts, the ranked panels ("Nothing here is stacked or double-encoded…"), the scorecard ("There is deliberately no single intelligence score: a model that answers grounded questions well and folds under prompt injection is a different problem from one that is mediocre at both…"), the table, and the archive ("Until this sprint a second run on a model overwrote the first, which meant a regression was invisible…"). | none | `scripts/publish-evals.mjs` (the archive behaviour, with a test), `evals/cases.mjs` (the groups) |
| draft | `app/measurements/models/page.tsx` → "What this does not measure" | Seven titled caveats: one sample per case and therefore no 95th percentile; latency includes the connection and the day; "The grader is a string matcher, not a judge" ("…a wrong answer containing the right number still passes"); "Costs are list prices, not an invoice"; "A broken turn is counted, but it is not counted as a wrong answer" ("…it says a model dropped streams here, then, not that it drops one in four everywhere"); "Token counts are each provider's own"; and "The corpus is narrow on purpose" ("…which is why the numbers are useful here — and why they do not transfer to yours"). | none | `evals/README.md`, `lib/pricing.ts` (`PRICES_CHECKED`, `PRICE_CONFIDENCE`), `lib/measurements.ts` (the percentile floors) |
| draft | `app/measurements/models/page.tsx` + `components/charts/*` | Chart and table labels — "turns graded", "cost of the whole comparison", "Time to first token", "Output speed", "Cost per turn", "Prompt cache hit rate", "fastest"/"cheapest"/"best", "on the frontier", "confirmed"/"cache rate derived"/"unconfirmed", and the two axis notes ("The vertical axis is zoomed to the measured range, not to zero.", "Share of input TOKENS served from the provider's cache — not share of turns."). UI affordances rather than prose, logged as one row. | none | `lib/pricing.ts`, `lib/chat-telemetry.ts` |
| draft | `app/llms.txt/route.ts` | One page description added to the machine-readable index: "/measurements/models — Every model this site can run, compared on one corpus: pass rate, latency, tokens and cost per task." | none | The page itself |
| draft | `app/measurements/page.tsx` → live runs note | One added sentence and a link: "…and every run is kept." plus "What each of these models cost and how fast it answered, plotted side by side: Five models, one corpus." | none | `scripts/publish-evals.mjs` |

**A note on the Track B rows — read this one first.** Every row above them says
`none` in the Claims column, because Track A published claims about the *site*,
and a claim about the site is checkable by anyone with this repo. **The TL;DR
and the feature surface are the first rows in this ledger that say `factual`.**
They are claims about a person, they sit above the fold on the homepage and on
the project page a recruiter is most likely to open, and there is no way to walk
one back after it has been read.

Three things about how they were built, because the wording is not the point —
the sourcing is.

First, **nothing in the TL;DR was written.** Each row is corpus text
re-registered into a shorter sentence, and each carries a `source` field naming
the file it came from. `evals/track-b.test.mjs` runs `lib/verify.ts` — the same
checker that marks a model's sentence unverified beside an answer — over every
row against that file, and a row whose numbers or proper nouns stop appearing
there fails the suite. It is the strictest thing on this site pointed at the
site's own copy rather than at a model's, which is the right way round given
which of the two a hiring manager will hold Sidhant to.

Second, **the feature surface is short on purpose, and the note under it is
part of the copy.** Sidhant's line about this page in `docs/idea-decisions.md`
is that there is "a shit ton of features buried up there" — and the corpus names
about a dozen. The gap between those two is real and it is not fillable by
guessing: a plausible feature is a factual claim about software a hiring manager
can go and use. So the list is what the record says, the note says the list is
incomplete, and the missing half is a `[VERIFY]` in the table below rather than
a paragraph somebody invented.

Third, **no caption describes an asset that does not exist.** Six of the seven
media slots are empty; they render as dashed frames carrying the brief for
whoever has to capture them. `src`, `alt` and the caption travel together in one
optional object, so a file cannot be added without being described and a
description cannot be written ahead of a file. The one filled slot's alt text
was written from looking at the image, not from the sentence next to it.

**A note on the refusal ledger.** This is the row that most needs Sidhant's eyes,
because it is the only page on the site that speaks for what he decided rather
than for what the code does. Three things about it are deliberate. First, every
entry is about the assistant, not about him — the one entry that records a
decision of his ("Make a general case against hiring him") quotes the reasoning
already in `docs/idea-decisions.md` §2 rather than inventing a new argument for
it, and it should be checked against what he actually meant. Second, the
`enforcedBy` column is a claim, and it is the page's only real one: entries
marked *enforced by code* are asserting that the rule holds whether the model
cooperates or not, so an entry that moves from `prompt` to `code` in a rewrite is
a promotion nobody measured. Third, nothing in the ledger is a rule invented for
the page — each one already ran before it was written down, and the anchors in
`lib/refusals.ts` are checked by the suite so that stays true.

**A note on the site's roast.** The roast is generated per turn and is therefore
not copy in this ledger's sense — no roast text is stored anywhere. What IS copy
is the instruction that shapes it, in `lib/system-prompt.ts`: be specific, cite
the repo, invent nothing, and stop at the site. That last clause is the one
carrying the weight of decisions §2's rejection of "the case against hiring me",
and it appears in both the base prompt and the appended block on purpose — a
site turn that missed the detector still has the limit on it.

**A note on the measurements rows.** Every string on `/measurements` describes
either the site's own machinery or the size of a sample, so none of them makes a
claim about Sidhant — but three are load-bearing and a rewrite that trims them
changes what the page asserts. The empty states must keep naming *which* thing is
missing: "no credentials" and "no events" mean different things and a reader who
can't tell them apart is being told the site works when it might not be. The
too-few line must keep refusing to print a percentage; the whole section exists
to avoid publishing a statistic its sample can't carry. And the job-description
caveat must survive as long as the published runs are job-description runs — the
counts above it read as the site's general groundedness otherwise, which is a
claim the evidence doesn't support in either direction.

**A note on the requirement-table rows.** Same rule as the citation rows below, one
level up: none of these strings says a requirement is unmet *in fact* — they say what
the assessment claimed and what the site could check. "Downgraded" describes an action
the code took, not a judgment about Sidhant. The requirement text beside them is the
POSTING's words, quoted as input, and is not site copy or a claim about him. The
closing note exists to stop four tags reading as a score, which is the rendering
constraint `docs/idea-decisions.md` §3 attaches to this component — a rewrite that
drops it gives the table a precision it doesn't have.

**A note on the export rows.** Same standing as the instrument rows: they are
claims about the site, not about Sidhant, and each one is checkable in this repo.
Two of them are load-bearing and should not be softened in a rewrite. The link
caveat says out loud that a permalink is readable by anyone holding it — the
decisions doc records that as a surviving caveat of #18, and dropping it would
leave a reader believing a link is private. And the replay banner exists so a
conversation from a link can never be mistaken for a live one; "snapshot", "the
site stored nothing" and "not a live session" are each doing separate work.

**A note on the citation rows.** These are the site describing its own check,
and the wording is load-bearing in one specific way: none of them says a
sentence is *wrong*. `unverified` means the numbers and names weren't found in
the chunk that was cited, which is what `lib/verify.ts` actually establishes.
Any rewrite that upgrades this to a truth claim would be asserting more than
the code can support.

**A note on the instrument rows.** None of them says anything about Sidhant — they
are claims about *the site*, which is a different thing and the reason they're all
`none`. They are still checkable, and the Source column says where: each one is
either arithmetic from `lib/pricing.ts` or a description of an exit in
`app/api/chat/route.ts`. If one of those behaviours changes, the string is wrong
and should move, which is why they're logged rather than treated as chrome.

**A note on the unreadable-assessment row.** One string, added with the fix for
the returning-visitor crash:

| File | String | Claims |
| --- | --- | --- |
| `components/shell/panel-body.tsx` | "This assessment was saved by an older version of the site and can't be shown. Paste the posting again to rebuild it." | none |

It is only reachable by a reader whose stored conversation or permalink predates
a change to the assessment's shape. Two things about the wording are deliberate:
it blames the site rather than the reader, and it names the way out. An empty
panel would have been the cheaper option and would have left someone staring at
a blank space wondering what they'd broken.

**Differentiation pass, 2026-07-28** (branch `feat/glyph-field`). Two strings and
a label pattern:

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `app/colophon/page.tsx` → "The site shows its workings" | New colophon section naming the transparency thesis: "One rule holds everything here together: anything the machine does, you can look at… A chatbot asking for a hiring manager's trust should have to show its receipts." Links /prompt, /refusals, /measurements. | none | Describes site behaviour only — every linked page exists and does what the sentence says |
| draft | `components/shell/app-shell.tsx` → ledger turn labels | `NN · you` mono rule above each visitor turn in the conversation (e.g. "01 · you"). | none | UI chrome |
| draft | `components/shell/use-conversation.ts` → `TOOL_PHASE`, `OPENING_PHASE`, `WRITING_PHASE` | The one-line status under a turn in flight, now naming the step instead of the wait. "reading the resume…" (unchanged, the default) · "reading the job description…" · "checking it against the record…" · "pulling up the project…" · "pulling up the resume…" · "finding the contact details…" · "writing the answer…" | none | Each string is read off a live stream part — the tool actually running when it shows. Nothing here asserts anything about Sidhant, and nothing claims work that isn't happening. |
| draft | `lib/system-prompt.ts` → Formatting | Rewritten paragraph now permitting fenced code blocks and pipe tables, with the guidance on when each earns its place ("A table with one column is a list, and a table with one row is a sentence." · "Never reformat a plain answer into a table to look thorough."). Published verbatim at `/prompt`. | none | Describes the renderer's capabilities, which `components/shell/markdown.tsx` now has |

**Chat resilience pass, 2026-08-09** (branch `ux/resilience-readability`). The chat
had no timeout anywhere on the client path: a stream that stalled — an iPhone
suspending the tab mid-answer is the case this was reported from — left the shell
believing a turn was still in flight, and every later send silently did nothing.
The fix adds two clocks and a way out, and a way out needs words. One sentence per
failure class replaces the single grey line that used to answer all of them:

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `lib/chat-telemetry.ts` → `TURN_ERROR_COPY.network` | "The connection dropped before the answer made it through. Check your signal and try again." | none | Names a state the client actually detects — a fetch that threw before the response existed. Nothing about Sidhant. |
| draft | `lib/chat-telemetry.ts` → `TURN_ERROR_COPY.upstream_timeout` | "The server stopped responding partway through. Give it another try." | none | The class raised by the 15s connect timeout and the 20s stream-inactivity watchdog in `use-conversation.ts`, and by the route's own mid-stream classification |
| draft | `lib/chat-telemetry.ts` → `TURN_ERROR_COPY.upstream_unavailable`, `.unknown` | "Something went wrong on my end. Give it another try in a moment." | none | Unchanged wording — this was the site's only error string before this pass, and it is now the fallback rather than the whole vocabulary |
| draft | `lib/chat-telemetry.ts` → `TURN_ERROR_COPY.upstream_unconfigured`, `.upstream_auth` | "The chat backend is misconfigured — this one is on me, not you." | none | Both classes are deploy problems (a missing or rejected `AI_GATEWAY_API_KEY`), so the sentence takes the blame rather than leaving the reader to wonder what they typed |
| draft | `lib/chat-telemetry.ts` → `TURN_ERROR_COPY.invalid_request` | "That message couldn't be sent as written. Try shortening it." | none | The route's 400 exit is a schema failure, and length is the only limit a visitor can realistically have hit (4000 chars on a user turn, `route.ts`) |
| draft | `lib/chat-telemetry.ts` → `turnErrorLabel` | The mono label above each sentence: "turn failed · connection" · "· server timeout" · "· upstream" · "· misconfigured" · "· bad request" · "· unknown" | none | Each is the site's own register for a class in the telemetry vocabulary, matching the existing `NN · you` label pattern |
| draft | `components/shell/turn-error.tsx` | "try again" — the button that resends the failed turn. | none | UI chrome; it calls `regenerate` |
| draft | `components/shell/app-shell.tsx` → stall hint | "stop" — appears beside the status line once a turn passes eight seconds, and aborts it. | none | UI chrome; it calls the SDK's `stop`, and an aborted turn deliberately renders nothing at all |

**A note on what is NOT here.** Two classes have no sentence. `rate_limited` keeps
routing to ManualMode, which answers with the corpus instead of an apology, and
`aborted` renders nothing, because the reader pressed stop and telling someone what
they just did is not information. `aborted` now renders nothing even when the class
arrives over a live stream rather than from the reader's own stop — it used to reach
the error block and print the literal class over the generic "something went wrong on
my end" sentence (`isSilentClass`, `lib/chat-telemetry.ts`).

**A note on the button.** "try again" is no longer rendered for `invalid_request`.
No string changed — the sentence is still "That message couldn't be sent as written.
Try shortening it." — but the button under it resent the identical message into the
identical rejection, so the one affordance on screen contradicted the only advice on
screen. The turn stays in the transcript and the composer is where it gets shortened
(`isRetryableClass`, `lib/chat-telemetry.ts`).

**Typography and ergonomics pass, 2026-08-09** (branch `ux/resilience-readability`).
A type scale replaced eleven ad-hoc sizes, and two composer strings changed with it.
Both are UI chrome; neither says anything about Sidhant.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `components/shell/app-shell.tsx` → composer placeholder | "Ask a question" — shortened from "Ask a question, or type / for commands", which was clipped mid-word at every phone width. Logged in `docs/site-copy.md`. | none | UI chrome. The dropped half taught the slash menu, which still announces itself the moment a "/" is typed. |
| draft | `components/shell/app-shell.tsx` → send button | "send ↵" — replaces a bare "↵" glyph below sm and an "enter ↵" hint above it. One labelled button at every width. Logged in `docs/site-copy.md`. | none | UI chrome; it submits the form, and ↵ is still the key that does it |

**Slow-network first load, 2026-08-09** (branch `claude/resilience-overhaul-three-workstreams-d3p1sg`).
Two strings exist only during the seconds between the page painting and its
JavaScript arriving — measured at 3.5s on a throttled mobile profile
(`npm run perf`). Both are UI chrome; neither says anything about Sidhant, and
neither is on screen once the page is live.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `components/shell/app-shell.tsx` → composer placeholder, pre-hydration | "Loading the conversation…" — replaces "Ask a question" until the page is interactive, on a field that is `disabled` for the same window. | none | UI chrome, and the honest state: the composer genuinely cannot take a question yet. Asserted by `npm run check:load`. |
| draft | `components/shell/app-shell.tsx` → status strip, pre-hydration | "loading" — replaces "ready" until the page is interactive, with the status dot stepped down to `--text-dim`. Shown at every width during load; below `sm` it collapses back to the dot alone once hydrated, which is the settled design. | none | UI chrome. The strip previously read "ready" from the first paint, which was the most confident false statement on the page — it is the readout a stuck visitor would check. |

**A `/projects` index, 2026-08-09** (same branch). The three case studies have
always had pages; `/projects` itself returned a 404. The index reuses
`content/projects.ts` verbatim for everything it says about the work — the same
strings the cards, the chat tool and the context panel read — so the only
drafted copy is the page's own furniture.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `app/projects/page.tsx` → h1 and metadata title | "Projects" | none | The section name already used by the context panel's `projects` view. |
| draft | `app/projects/page.tsx` → intro | "Three case studies. The conversation will summarise any of them — these are the long versions." | none | A statement about this site, checkable in this repo: three entries in `PROJECT_LIST`, and the `showProject` tool reads the same file. |
| draft | `app/projects/page.tsx` → metadata description | "Three case studies, and what each one was." | none | Same. |
| draft | `app/projects/page.tsx` → link label | "Read the case study →" | none | UI chrome; it navigates to `project.caseStudyHref`. |

**A client error boundary, 2026-08-09** (same branch). Added because the
pre-hydration gate has a failure mode: if hydration never completes, the
composer stays honestly disabled forever. Same register as `app/not-found.tsx`.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `app/error.tsx` | "Something broke in the browser and the conversation didn't start. That one is on me, not you." | none | Takes the blame the way `lib/chat-telemetry.ts` already does for the two deploy-side error classes. Says where it broke (the browser) without guessing why. |
| draft | `app/error.tsx` → buttons | "Try again" · "Read the resume instead →" | none | UI chrome. The first calls Next's `reset()`; the second is a plain link to a server-rendered document, so the fallback does not need the thing that just failed. |

**The chat knows its own limits, 2026-08-18** (branch `main`, from an unlanded
worktree). The prompt never told the assistant it was rate limited, so asked
directly it either guessed or said it had no limits — a claim the route
contradicts on the eleventh message.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `lib/system-prompt.ts` → Scope | **Model-facing, and published verbatim at `/prompt`.** One paragraph stating that the chat is rate limited on purpose: a conversation allows at most 10 visitor messages, and each visitor gets 20 messages an hour on the standard tier and 5 on the premium one, in separate sliding one-hour buckets, after which the chat returns its rate-limited state. Closes with "Never tell a visitor this chat is unlimited or has no rate limits." | none about Sidhant; three factual claims about the site | Every number is interpolated from `TIER_LIMITS` and `MAX_USER_MESSAGES` in `lib/models.ts` — the same constants the route enforces and the status strip renders — so the sentence cannot drift from the behaviour. `evals/static.test.mjs` fails the build if a literal is retyped here. |

**The front door mockups, 2026-08-22** (branch `main`, unshipped). Three
explorations in `docs/mockups/front-door-*.html` for the "5-second clarity"
homepage pass. Mockups, not shipping surfaces — but per the ledger rule they
don't go to Sidhant's review unlogged. All tl;dr rows are verbatim from
`content/recruiter.ts` and are not re-logged here; only the new strings are.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `docs/mockups/front-door-*.html` → hero subline | "Looking for a RevOps / GTM systems role at an AI-forward company. Toronto, ON — Canadian citizen, no visa sponsorship needed." | two, both about Sidhant | A recombination of the `looking for` and `where` TL;DR rows in `content/recruiter.ts` (both sourced to `content/knowledge/faq.md`). No new fact. |
| draft | `docs/mockups/front-door-*.html` → CTA labels | "View resume" · "Email me" · "Interview this site" | none | UI chrome. "Interview this site" doubles as the exhibit-panel title in variant 2. |
| draft | `docs/mockups/front-door-2-split.html` → composer placeholder | "Or paste a job description" | none | UI chrome; the JD flow exists (Sprint 4). |
| draft | `docs/mockups/front-door-*.html` → composer fine print | "Answers cite their sources — this chat publishes its system prompt and eval results, and shows what each answer costs. It can make mistakes; the resume is the authoritative version." | four, all about the site, none about Sidhant | Citations ship since Sprint 3, `/prompt` since Sprint 7, `/measurements` since Sprint 6, the cost meter since Sprint 2. Replaces the current disclaimer rather than adding a second line. |

**The front door ships, 2026-08-23** (branch `front-door`). Variant 1 of the
mockups above, chosen by Sidhant. The mockup rows above stay as the record of
the exploration; these are the strings as they ship. The hero heading, the
tl;dr rows and the chips are unchanged and already logged.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `content/recruiter.ts` → `POSITIONING`, rendered as the hero subline | "Looking for a RevOps / GTM systems role at an AI-forward company. Toronto, ON — Canadian citizen, no visa sponsorship needed." | two, both about Sidhant | The `looking for` and `where` TL;DR rows fused; source `content/knowledge/faq.md`. Checked by `evals/track-b.test.mjs` with the same citation pass as the rows — verified green on 2026-08-23. |
| draft | `components/shell/app-shell.tsx` → CTA row | "View resume" · "Email me" · "Interview this site ↓" | none | UI chrome. Resume links `/resume`, email uses the `SOCIAL_LINKS` address, the third focuses the composer. |
| draft | `components/shell/app-shell.tsx` → header nav (empty state) | "Resume · Projects · Colophon · Contact" | none | UI chrome; real routes plus the contact panel. Replaced by the telemetry readouts once a conversation starts. |
| draft | `components/shell/app-shell.tsx` → composer fine print (empty state) | "Answers cite their sources — this chat publishes its system prompt and eval results, and shows what each answer costs. It can make mistakes; the resume is the authoritative version." | four, all about the site, none about Sidhant | Citations since Sprint 3, `/prompt` since Sprint 7, `/measurements` since Sprint 6, the cost meter since Sprint 2. Replaces the empty state's `DISCLAIMER` render and carries its sentence; `DISCLAIMER` itself still ships in exports and print. |
| draft | `components/shell/app-shell.tsx` → composer placeholder (empty state, md up) | "Ask what you'd ask on a call" | none | The 2026-07-27 hero subline, moved surfaces — trailing period dropped for a placeholder. Phones keep "Ask a question" (the long version clips at 320px). |

**The catalogue refresh, 2026-10-19** (branch `claude/model-catalogue-oct-68d800`).
Haiku 4.5 and GPT-5.6 Luna were replaced by their successors, and
`/measurements/models` measured the old five. The page now says which measured
models the chat dropped and which offered ones nothing has measured, and stops
printing July's costs beside October's price labels. These strings replace the
corresponding ones in the Sprint 8 rows above.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `app/measurements/models/page.tsx` → metadata description | "Five models this site has run, measured against the same eval corpus: pass rate, time to first token, output speed, tokens and cost per task." Was "Every model this site can run…", which stopped being true on 2026-08-12. | none about Sidhant; one about the site | The snapshot holds five models, all of which were in the catalogue when the bake-off was published (`git show 2150a80:lib/pricing.ts`). |
| draft | `app/measurements/models/page.tsx` → intro | "This site runs a handful of models behind one chat endpoint. This page is what happened when the five it ran at the time answered the same 22 questions, in the same order, against the same server, on the same afternoon — graded by the same checker, and costed at list price." Only the first clause and "the five it ran at the time" are new. | none about Sidhant; one about the site | Same as above. |
| draft | `app/measurements/models/page.tsx` → catalogue note | "The chat has changed models since this was measured. Every figure below belongs to the model it names, and none of it carries over to a successor." then "Measured here, no longer offered: {ids}." and "Offered now, not measured yet: {ids}." Shown only when the two sets differ. | none | The ids are computed by `catalogueDrift` in `lib/model-comparison.ts` from the snapshot and `lib/models.ts`, so the note cannot fall out of step with either. |
| draft | `app/measurements/models/page.tsx` → table | Column header "price now" (was "price"); the flag for a measured model the chat no longer offers reads "no longer offered" (was "no price on record", printed beside a figure that had been priced). | none | `PRICE_CONFIDENCE` has an entry for every offered model, so a missing entry means a dropped model. |
| draft | `app/measurements/models/page.tsx` → table note | "Costs are at the list prices on record when each run was published, and are not recomputed when a price changes; "price now" describes the chat's current prices, checked {PRICES_CHECKED}." Replaces "Prices checked {PRICES_CHECKED}." | one about the site | `evals/lib/performance.mjs` prices each run at publish time and the snapshot stores the result. |
| draft | `app/measurements/models/page.tsx` → "Costs are list prices, not an invoice" | Body rewritten: costs are the run's tokens at the list rates on record when it was published, not recomputed on a price change, and "Two of those rates have since been corrected": gpt-5.6-luna costed at an unconfirmed $1.00 in / $6.00 out per million, five times what the Gateway later published; gemini-3.5-flash-lite's cache reads at a derived rate two and a half times the published one. | none about Sidhant; two price facts | Luna: `git show 2150a80:lib/pricing.ts` ($1.00/$6.00, marked unconfirmed) against the $0.20/$1.20 published by 2026-08-12. Gemini: $0.075 derived in the same file against $0.03 on the Gateway's `/v1/models`, checked 2026-10-19. |
| draft | `app/llms.txt/route.ts` | "/measurements/models — Five models this site has run, compared on one corpus: pass rate, latency, tokens and cost per task." Was "Every model this site can run…". | none about Sidhant; one about the site | Same as the metadata row. |

**One hourly budget for every model, 2026-10-19** (same branch). The premium
tier was removed and GPT-6 Luna made the default, both following the smoke
test in `docs/followups.md` §2. Every string that named a tier now names the
single budget. No page names the default model in prose; the colophon's "runs
on Claude" belongs to the copy session's wave 1 and is not touched here.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `lib/system-prompt.ts` → Scope | **Model-facing, and published verbatim at `/prompt`.** The rate-limit paragraph now reads: a conversation allows at most 10 visitor messages, "and each visitor also has an hourly allowance of 20 messages, shared across every model, on a sliding one-hour window. Past either limit the chat returns its rate-limited state until the window passes…" Replaces the two-tier sentence (20 standard, 5 premium, separate buckets). | none about Sidhant; two factual claims about the site | Both numbers are interpolated from `HOURLY_LIMIT` and `MAX_USER_MESSAGES` in `lib/models.ts`, the constants the route enforces. `evals/static.test.mjs` still fails on a retyped literal. |
| draft | `components/shell/app-shell.tsx` → header strip | The budget readout's label is "hourly", as in "hourly 17/20". It used to print the tier name, "standard" or "premium". | none | `x-budget-remaining` / `x-budget-limit` from the route. |
| draft | `components/shell/instruments.tsx` → cost meter | Row label "hourly budget", as in "17/20 left". Was "{tier} budget". The trace's per-turn "tier" row is removed. | none | Same headers; there is no tier left to report. |
| draft | `lib/chat-telemetry.ts` → failure theatre, `rate_limited` | "The hourly budget is spent, or the conversation passed ten turns." Was "The hourly per-tier budget is spent…". | one about the site | The route's two 429 exits. |

**Wave 1 of the council plan, 2026-10-19** (branch `claude/wave-1-fixes`). Fixes
for what the two council reviews found broken: a turn that ends blank, markers
on public pages, and sentences that were no longer true.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `lib/chat-telemetry.ts` → `TURN_FAILURES.empty_answer` | Label "turn failed · no answer", then "The model ran out of room before it got to an answer. That's a limit on my end, not a problem with your question." | none | The state the transport now detects: a complete turn with no text and no tool output, which on the default model is a reasoning model stopping on `finishReason: "length"`. The output ceiling is the site's own setting (`route.ts`), so the sentence takes the blame. |
| draft | `components/shell/turn-error.tsx` → second button | "ask {model} instead", with the next model id in catalogue order, e.g. "ask deepseek-v4-flash-0731 instead" from the gpt-6-luna default. Shown only on the empty-answer state, beside "try again". | none | UI chrome. The id is read from `lib/models.ts`, so it follows the catalogue. |
| draft | `lib/chat-telemetry.ts` → failure theatre `cause` and `wire` for `empty_answer` | "A reasoning model spent its whole output budget thinking and finished with no text and no tool output." · "200, finishes empty" | none | Instrument-deck prose, like the other eight `cause` rows. |
| removed | `components/project-media.tsx` → media surface | Only slots with a file render. Off the page: the six empty frames, their "Nothing here yet — waiting on a {kind}." text and "{title} — not captured yet." captions, and the intro "Frames with nothing in them are waiting on a file…". The heading "What it looks like" and the one filled slot stay. | none | Council review: empty frames on the flagship case study read as unfinished work. The briefs stay in `content/adarle20-media.ts` and are pending below. |
| removed | `components/project-media.tsx` → `FEATURE_SURFACE_NOTE` | Not rendered while it carries its `[VERIFY]` marker. The draft stays in `content/adarle20-media.ts`. | none | Pending below. |
| removed | `app/colophon/page.tsx` | "The spec, design brief, and source are on GitHub. [TODO: confirm repo is public before linking]" | none | The repo is public and so is `docs/`, so linking it is an open decision, pending below. |
| draft | `lib/site.ts` → `COLOPHON_STACK`, on `/colophon` and in the colophon panel | "…The chat assistant runs through Vercel's AI Gateway on {DEFAULT_MODEL} by default, with the knowledge base injected directly into the prompt…" — was "runs on Claude through Vercel's AI Gateway". The rest of the paragraph is unchanged. | one, about the site | The id is interpolated from `DEFAULT_MODEL` in `lib/models.ts`, the same constant the route falls back to, so it can't go stale. |
| draft | `content/projects.ts` → Dell card `stack` | "Azure ML" — was "Azure ML, Python". | **factual** | `content/knowledge/projects-dell.md` names Azure ML and no language. "Python" comes back if Sidhant confirms it (pending below). |
| draft | `components/shell/panel-body.tsx` → job-description form | The character counter and cap now read 3,903; was 3,500. | none | UI chrome. It is the route's 4,000-character limit on a user turn (`MAX_USER_TEXT` in `lib/job-posting.ts`) less the 97-character prefix the panel sends ahead of the posting, so a full paste lands exactly on the server's limit. |
| draft | `lib/site.ts` → `RESUME_PDF_FILENAME`, on every resume PDF link | The resume saves as "Sidhant_Mathur_Resume.pdf" (the `download` attribute) rather than "resume.pdf". | none | The file is unchanged; only the name it saves under. |

**The case studies, reworked for RevOps, 2026-10-19** (branch
`worktree-agent-a01b01ab843a404c0`). Both council reviewers read `/projects/nokia`
as the proof for the target role; Opus called it the thinnest page on the site
and asked for a business-outcome page, Fable asked to keep its honesty and
business framing. `/projects/adarle20` had its RevOps-shaped parts — the unit
economics and the funnel — as one sentence each. Every number and name below is
in `content/knowledge/`, and a new block in `evals/track-b.test.mjs` runs every
paragraph of both pages through `lib/verify.ts` against the corpus files named
here. Where a sentence needed a fact the record lacks, the sentence was left out
and the question is listed after the rows. Both pages are mirrored in
`docs/site-copy.md` under a dated draft note.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `content/nokia.mdx` → "At a glance" | Five labelled lines opening the page: Role ("Sales operations specialist (internal tools and automation) at Nokia, Toronto. June 2024 to present; the tools below have been in production since 2024.") · Systems ("Power Apps, Power BI, SQL and DAX. Salesforce Analytics was the system being retired.") · Quarterly executive reporting ("a self-serve Power App used by 80+ stakeholders across seven regions. It replaced the manual collection process entirely.") · Time given back ("one finance analyst's entire workday, every day of quarter-end close.") · Sales reporting ("all of it migrated from Salesforce Analytics to Power BI for 150+ users, with the data model and the SQL and DAX transformation logic owned end to end."). | **factual** | Title, dates and city: `resume.md` ("Nokia — Toronto, ON"; "Sales operations specialist (internal tools & automation) · Jun 2024 – Present"). "In production since 2024", 80+ across seven regions, the analyst's workday, 150+ users, SQL and DAX, "replaced the manual collection process entirely": `projects-nokia.md`. "Power Apps": the resume's skills line. |
| draft | `content/nokia.mdx` → "Before and after" | Two labelled paragraphs. Before: manual data collection; one finance analyst's entire workday, every day of quarter-end close, chasing inputs across regions and formats; sales reporting in Salesforce Analytics, which the organization was moving away from. After: the 80+ stakeholders across seven regions "report through a self-serve Power App, and the manual collection process is gone"; sales reporting "runs on Power BI for 150+ users, on a data model and transformation logic I built and own." | **factual** | `projects-nokia.md` (the problem paragraph, near verbatim; the two tools and their numbers) and `resume.md` ("owned data modeling, transformation logic (SQL/DAX)"). "Report through" restates "self-serve", the same reading the logged plain-language section already makes ("something the regions can fill in themselves"). |
| draft | `content/nokia.mdx` → "How I ran it" | "For both tools I was the whole team." then four labelled lines: Requirements ("vague requests from sales and finance leadership, translated into scoped requirements") · Build ("the Power App; the Power BI data model and its transformation logic in SQL and DAX") · Rollout ("executive demos, then a global rollout to the stakeholders") · Support ("user support, bug triage and rapid iteration, across time zones"). Then the LLM-and-Python sentence and the confidentiality note, both carried over unchanged. | **factual** | `resume.md`, third Nokia bullet ("translating vague requests from sales and finance leadership into scoped requirements, then executive demos, global rollout, user support, and rapid iteration across time zones") and `projects-nokia.md` ("requirements, build, executive demos, user support, bug triage, and iteration across time zones"; the LLM and Python sentence; the note). |
| draft | `content/nokia.mdx` → "Before this role" | "I joined Nokia in October 2022 as a workforce management specialist, owning headcount reporting and forecasting for a 3,000–4,000-person organization. Analyzing lab and facility utilization data in that role identified $1.2M in real-estate cost savings." | **factual** | `resume.md` and `bio.md`: "Workforce management specialist · Oct 2022 – Jun 2024" and its two bullets, in substance verbatim. "Joined": `bio.md` says the freelance work "wound down when he joined Nokia". Added because it is the one dollar figure from a job in the record, and forecasting is the RevOps-adjacent half of that role. |
| draft | `content/nokia.mdx` → "In plain terms" | **Moved** from the head of the page to below "Before this role", above the closing line. Text as logged in the #20 row, with one phrase changed because the section no longer precedes the rest of the page: "The second half of this page is the same job wearing different clothes" → "The migration is the same job wearing different clothes". | none | Restatement only; it still carries no numeral, and `evals/track-b.test.mjs` still asserts that. |
| removed | `content/nokia.mdx` → "The problem", "What I built" | The two original section headings. Their sentences live on in "At a glance", "Before and after" and "How I ran it"; nothing was cut, only re-sectioned. "What I'd tell a hiring manager" is unchanged and still closes the page. | none | — |
| draft | `content/adarle20.mdx` → "The unit economics" | "Payment runs through the site rather than around it: Stripe Connect handles the host payouts and the platform fee, OXXO lets a player with no card pay in cash at a convenience store, and refunds are automated rather than handled by hand." then "Running it has taught me as much about unit economics as about code: we've tested a commission model against direct event ticket sales and made real decisions about where the margin actually is — and the unglamorous parts, refunds, payment edge cases and infrastructure costs, are part of that arithmetic." | **factual** | `projects-adarle20.md` (Stripe Connect, host payouts, platform fees, OXXO, the commission-versus-ticket-sales sentence, "the unglamorous parts like refunds, payment edge cases, and infrastructure costs") and `resume.md` ("automated refunds", "low-card-penetration Mexican customer base"). "Through the site rather than around it" restates the logged plain-language line "the payment goes through the site". What the commission test decided, and any revenue, GMV or take-rate figure, is not in the record and is not on the page — questions below. |
| draft | `content/adarle20.mdx` → "The funnel, instrumented" | "The funnel is instrumented end to end — bookings, conversion, cancellations, refunds, host activation — so there is a number for every stage on both sides of the marketplace: players who visit, register and book, and hosts who activate. That data steers product and monetization decisions, which is how the question above gets answered with evidence rather than instinct." | **factual** | `projects-adarle20.md` and `resume.md`: the instrumentation sentence, verbatim for its list; "registered users", "unique visitors", "hosts", "bookings". The heading reuses the media slot title in `content/adarle20-media.ts`. Which tool does the measuring, and which decisions the data changed, are not in the record — questions below. |
| draft | `content/adarle20.mdx` → "What I built", "Where it stands" | Two sentences moved out, not cut: the funnel sentence left "What I built" for its own section, and "Running it has taught me as much about unit economics…" left "Where it stands" for its own section. The rest of both is unchanged. | none | — |
| draft | `content/adarle20.mdx` → "In plain terms" | **Moved** from the head of the page to below "Where it stands", above the closing line. One word changed: "Most of what's described below" → "described above". | none | Restatement only, still numeral-free. |
| draft | `content/adarle20.mdx` → "What I'd tell a hiring manager" | No words changed. The source broke the line after the hyphen in "revenue-generating", which MDX rendered as "revenue- generating" on the page (visible in the before screenshots); the line now breaks before the word. | none | Typography, not copy. |

Left off the pages for want of a fact — the questions for Sidhant, in the order
the pages would use the answers:

1. Nokia, the migration: how many reports or dashboards moved from Salesforce
   Analytics to Power BI, and from how many data sources?
2. Nokia, the timeline: when did the Power App ship, and when did the migration
   finish?
3. Nokia, the close: how many hours does the Power App give back per quarter-end,
   or how many days does the close run? The build spec's "4–6 hrs/day" is not in
   the knowledge base and the resume says "entire workday" — which one stands?
4. Nokia, adoption now: active users of each tool today, against the 80+ and
   150+ at rollout.
5. Nokia, the cycle: did the close or the forecast cycle get shorter, and by how
   much?
6. Nokia, the LLM and Python work: what it actually was, and what it replaced.
7. Nokia, a data-flow figure: what feeds the Power BI model (which sources,
   sanitized), so the diagram Opus asked for can be drawn without guessing.
8. The resume's "150+ users across 7 regions" and "3+ years owning sales
   reporting" (Opus's consistency note): the page avoids both phrasings; confirm
   which figures belong together.
9. A Darle 20: what the commission-versus-ticket-sales test decided, and any
   revenue, GMV or take-rate range you would publish.
10. A Darle 20: which tool instruments the funnel, and one or two decisions the
    data changed.

**Wave 2 of the council plan, 2026-10-19** (branch `worktree-agent-ad0a5e15366e3ef87`).
The recruiter front of house: the name and role line, the CTA row, the reordered
tl;dr and its two case-study cards, the header and the document-page chrome, the
citation marks, and the mobile fold. Sidhant had not recorded his decisions when
this was drafted; where a choice was his, the council synthesis's recommendation
was taken and the row says so.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `components/shell/answer.tsx` → citation margin (lg) | Margin marks per verdict: "uncited" (unchanged) · "not in source" (faint, was red "unverified") · "not in record" (accent). | none | Labels for `lib/verify.ts`'s verdicts. "not in source" is the new `miscited` verdict: the token is in the record under a different chunk. Only "not in record" — a number or name no chunk contains — keeps the accent. |
| draft | `components/shell/answer.tsx` → source row under an answer | "not in cited source · one sentence names facts the record holds under a different source. See the trace" (or "{n} sentences name"). "not in the record · {tokens}, in "{sentence}"" for the strong case. | none | The site describing its own check. "See the trace" opens the instruments panel, where the per-token detail now lives. |
| draft | `components/shell/instruments.tsx` → "Citations" section | Heading "Citations", hint "checked by string comparison". Rows: "answer {n}" · "{k}/{m} verified"; per claim "not in the cited chunk", "cited", "found in", "in no source", "no such source". Empty state: "Nothing checked yet. Every sentence that names a number or a proper noun is checked against the source it cites, and lands here." | none | Instrument-deck prose; restates what `lib/verify.ts` does. |
| draft | `components/shell/panel-body.tsx` → requirement-table row marks | "not in the record · {tokens}" (accent) or "not in cited source · {tokens} — in {chunk ids}" (faint). Was "unverified · {tokens} — not in {ids}" in the accent for both. | none | Same split as the answer marks. |
| draft | `content/recruiter.ts` → `ROLE_LINE`, the name and role line above the H1 (with "Sidhant Mathur" over it and the headshot beside it) | "Revenue and sales operations: I build the tools sales and finance teams run on." | **factual** — his role, and who the tools are for | `resume.md`: "AI-native revenue operations builder", "Sales operations specialist", "quarter-end close infrastructure for global sales and finance teams at Nokia", "vague requests from sales and finance leadership". Checked by `evals/track-b.test.mjs` like the rows. The H1 is unchanged. Wording is Sidhant's call (synthesis decision 5); this is the council's starting point with "Revenue operations and GTM systems" swapped for "Revenue and sales operations", the terms in his own target ("RevOps, Sales Ops mostly"). |
| draft | `content/recruiter.ts` → `RECRUITER_TLDR` row "now" | "Sales operations specialist at Nokia since Jun 2024, building internal tools and automation for global sales and finance teams." | **factual** | `resume.md`: the title line "Sales operations specialist (internal tools & automation) · Jun 2024 – Present" and the summary's "global sales and finance teams". Replaces the `bio.md` row "Sales operations specialist at Nokia, in Toronto. Co-founder and CTO of A Darle 20." |
| draft | `content/recruiter.ts` → `RECRUITER_TLDR` row "shipped" | "A self-serve Power App used by 80+ stakeholders across 7 regions, which ended a manual process that took one finance analyst's entire workday, every day of quarter-end close — and the migration of all sales reporting from Salesforce Analytics to Power BI for 150+ users." | **factual** | `resume.md`, the two Nokia bullets, near-verbatim. "Ended" restates "eliminating". Was the A Darle 20 row; the old Nokia row ("before that") is gone. |
| draft | `content/recruiter.ts` → `RECRUITER_TLDR` row "also" | "Co-founder and CTO of A Darle 20, a two-sided marketplace he architected and shipped solo: 1,400+ registered users, 127 hosts and 2,100+ bookings in its first four months." | **factual** | `resume.md`: the A Darle 20 title line and bullets. Same facts as the old "shipped" row, second now. |
| draft | `content/recruiter.ts` → `CASE_CARDS`, under the tl;dr | Label "case studies". Nokia: "Reporting tools at Nokia" · "150+" · "users on the sales reporting he moved from Salesforce Analytics to Power BI". A Darle 20: "A Darle 20" · "2,100+" · "bookings in the marketplace's first four months". Link: "Read the case study →". | **factual** (the two numbers) | `projects-nokia.md` ("migration of all sales reporting from Salesforce Analytics to Power BI for 150+ users"), `projects-adarle20.md` ("Four months in … 2,100+ bookings"). Checked by `evals/track-b.test.mjs`. 150+ rather than "80+ across seven regions" because the resume summary's "150+ users across 7 regions" joins two separate figures, which Opus flagged — the card keeps them apart. |
| draft | `content/recruiter.ts` → fourth chip | "What did he build at Nokia?" — replaces "Does he need visa sponsorship?" | none | A question, not a claim. The visa answer is in the hero subline. Doesn't trip `looksLikeJobPosting` or `looksLikeSiteQuestion` (asserted). |
| draft | `components/contact-actions.tsx` → CTA row (front door) and contact block (document pages) | "Download resume (PDF)" · "hello@sidhantmathur.com" with "copy" (→ "copied", or "selected" when the clipboard is refused) · "LinkedIn ↗". Screen-reader status: "Email address copied." / "Email address selected. Press Command or Control C to copy it." Copy button name: "Copy hello@sidhantmathur.com". | none | UI chrome. Address and LinkedIn URL from `faq.md` / `resume.md` via `lib/site.ts`. Was "View resume · Email me". |
| draft | `components/shell/app-shell.tsx` → text links under the CTA row | "Resume as a web page" · "Interview this site ↓" | none | UI chrome. "Interview this site ↓" was a third button; the HTML resume was the primary button. Resume target is an open question — see the synthesis. |
| draft | `app/layout.tsx` → homepage `<title>` and `og:title` | "Sidhant Mathur — RevOps and sales operations" | **factual** — his field | His target in his own words ("RevOps, Sales Ops mostly") and his title. Other routes keep "{page} — Sidhant Mathur". |
| draft | `app/layout.tsx` → meta description, `og:description`, Person JSON-LD `description` | "Revenue and sales operations: I build the tools sales and finance teams run on. Sales operations specialist at Nokia, co-founder and CTO of A Darle 20, based in Toronto. Looking for a RevOps / GTM systems role." | **factual** | `ROLE_LINE`'s grounding, plus `resume.md` (titles), `faq.md` (Toronto, target role). `jobTitle` stays out of the JSON-LD per the existing note. |
| draft | `app/llms.txt/route.ts` → opening paragraph | "Revenue and sales operations: I build the tools sales and finance teams run on. Sales operations specialist at Nokia, and co-founder and CTO of A Darle 20, a marketplace for tabletop game sessions in Latin America. Looking for a RevOps / GTM systems role." Nokia's page now listed before A Darle 20's. | **factual** | As above. |
| draft | `app/opengraph-image.tsx` → share card | Headshot, "Sidhant Mathur", "Revenue and sales operations", "I build the tools sales and finance teams run on." Alt: "Sidhant Mathur — revenue and sales operations". Was the name and the hero heading. | **factual** | Read from `ROLE_LINE`, so it can't drift from the checked string. |
| draft | `components/shell/app-shell.tsx` → headshot `alt` | "Sidhant Mathur" | none | The photo Sidhant supplied (`public/images/headshot.jpg`). |
| draft | `components/shell/app-shell.tsx` → header receipt (after the first turn, lg up) | "{n}/10 turns · last answer {$cost}" (or "—" before an answer is priced). Opens the instruments; title "Open the instruments". | none | `receiptText` in `readouts.ts`; the numbers the strip already measured. Replaces "turns · ttft · tok/s · est. · hourly" and the model select. |
| draft | `components/shell/shell-data.ts` → `HEADER_NAV` | "Resume · Projects" plus the "Contact" button, at every width and after the first turn. "Colophon" removed from the header. | none | UI chrome. Was replaced by telemetry once a conversation started. |
| draft | `components/shell/shell-data.ts` → index groups | Group labels "Work", "Contact", "How this site works". Items renamed or added: "How it's built" (was "Colophon"), "Measurements" (new entry). Removed: "Why this site is a chatbot", the "Contact" panel entry (the group shows the address, LinkedIn and GitHub directly). | none | UI chrome. Opus's regrouping. |
| draft | `lib/models.ts` → `MODEL_NAMES` | "GPT-6 Luna", "DeepSeek V4 Flash", "Claude Haiku 5.5", "GPT-5 mini", "Gemini 3.5 Flash-Lite"; the default reads "GPT-6 Luna (default)" in the picker. Also in "ask {name} instead" and the rail sheet's model readout. | none | Product names for the catalogue ids. |
| draft | `components/shell/instruments.tsx` → "Model" section | Hint "for the next question". "Every model spends from the same hourly budget, so switching changes what the meter below charges and nothing else. The id it runs under is {id}." | none | Describes `HOURLY_LIMIT` (one budget for every model) and the pricing table. |
| draft | `components/shell/shell-data.ts` → `WHY_CHATBOT_HEADING`, on `/colophon` and in the colophon panel | "Why there's a chat on a portfolio" — heading over the four "Why this site is a chatbot" paragraphs, which are unchanged and still draft. | none | The panel it replaces was titled "Why this site is a chatbot". |
| draft | `components/shell/panel-body.tsx` → contact panel | The copyable address and "Download resume (PDF)" above "GitHub ↗" and "LinkedIn ↗". Was three links, one a bare mailto. | none | UI chrome. |
| draft | `components/layout/doc-page.tsx` → header on every document page | "Sidhant Mathur" (home) · "Resume" · "Projects" · "Contact" (to `#contact`). Was "← Back to the conversation". | none | UI chrome. |
| draft | `components/layout/doc-page.tsx` → `DocContact`, the end of every document page | Label "Contact"; "Open to new roles — the resume, an email or LinkedIn, whichever is quickest."; then the three contact controls. | **factual** — that he is open to new roles | `faq.md`: "Is he open to new roles? Yes — open to new roles." |
| draft | `components/case-study-layout.tsx` → the end of each case study | Label "Contact"; "If this is the kind of work you're hiring for, the resume has the rest."; the three contact controls; then "Next case study" · "{title} →" · "{status}" (Nokia → A Darle 20 → Dell → Nokia). | none | UI chrome; titles and status lines from `content/projects.ts`. In the shared layout, not the `.mdx` files. |
| draft | `app/resume/page.tsx` → heading | Label "Resume" over the heading "Sidhant Mathur". Was the heading "Resume". | none | His name, as `resume.md` opens. |
| draft | `content/projects.ts` → order and index numbers | Nokia "01", A Darle 20 "02" (were 02 and 01), on `/projects`, the projects panel and the index. | none | Order only; no card copy changed. |
| draft | `components/shell/app-shell.tsx` → composer fine print (empty state) | Below lg: "AI answers can be wrong." · lg up: "Answers cite their sources and can be wrong — the resume is the authoritative version." Both followed by the link "How it works" (to `/colophon`). | one, about the site | Replaces the four-claim proof line logged under the front-door rows; its claims (published prompt, published evals, the cost meter) are on the colophon. `DISCLAIMER` in `lib/site.ts` still ships with exports and print, unchanged. |
| removed | `components/shell/app-shell.tsx` → composer fine print (empty state) | "Answers cite their sources — this chat publishes its system prompt and eval results, and shows what each answer costs. It can make mistakes; the resume is the authoritative version." | — | Four lines on a phone; see the row above. |

**The fit check: steps you can see, 2026-10-19** (branch
`worktree-agent-ab22acd4eb6a2a223`). A pasted posting now shows three named
steps instead of one string, plus a readout of what the stream is doing
inside the step. All of these strings are read off the live stream and say
nothing about Sidhant. The labels are short on purpose. At 375px the line
shares its row with the readout, the timer and the stop button, and
"checking 14 requirements…" wrapped onto two lines. Measured widths are in
`lib/turn-phase.ts`.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `lib/turn-phase.ts` → `JD_READING_PHASE` (the extraction step's label) | "reading the posting…". Shown from the moment a posting is sent, through the extraction step. It used to read "reading the resume…" until the extraction call began. | none | The route's own `looksLikeJobPosting`, run on the same text, and then the route's `jobPosting` flag on the stream |
| removed | `lib/turn-phase.ts` (was `use-conversation.ts`) → the extraction step | "reading the job description…". Replaced by "reading the posting…", which fits at 375px beside the readout. | none | — |
| draft | `lib/turn-phase.ts` → `JD_CHECKING_PHASE` | "checking the fit…". The judging step, from the moment extraction returns until the card is in. Through the reasoning before the rows, it used to say "writing the answer…", which was false. | none | The `roleFit` step, read off the stream |
| draft | `lib/turn-phase.ts` → `JD_WRITING_PHASE` | "summarizing…". After the card, while the model writes the sentences under it. On posting turns this was "writing the answer…". | none | The step after `roleFit` |
| draft | `components/shell/phase-line.tsx` → readout (`formatActivity` in `lib/turn-phase.ts`) | "thinking" while a reasoning part is open; "6/14" (rows so far out of requirements extracted) while the assessment streams. Beside the timer, aria-hidden. | none | `reasoning-start`/`reasoning-end` parts; the `roleFit` call's partial input |
| draft | `lib/turn-phase.ts` → `TOOL_PHASE`, `OPENING_PHASE`, `WRITING_PHASE` | Moved unchanged from `components/shell/use-conversation.ts`: "reading the resume…" · "checking it against the record…" · "pulling up the project…" · "pulling up the resume…" · "finding the contact details…" · "writing the answer…". Logged so the older row's "Where" isn't stale. | none | — |

**The fit check's summary, strengths first, 2026-10-19.** A policy call for
Sidhant, in its own commit so it can be dropped. Before and after summaries
from real runs are in `docs/followups.md` §2, "The summary, strengths first".

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `lib/system-prompt.ts` → Tools, the `roleFit` entry | **Model-facing, and published verbatim at `/prompt`.** Four bullets replace one sentence ("The sentence you write after the tool call is prose like any other…"). (1) The summary is `verdict`, "one line of under 25 words", plus "the two or three sentences you write after the tool call". Both lead with the strongest matches, then say what the ramp would be, with the example "Strong on sales reporting and quarter-end close; the ramp would be Salesforce administration and CPQ.", and neither opens with a grade ("a partial fit", "not a strong fit", "an adjacent fit"). (2) "Leading with the matches changes the order, never the verdicts." No requirement is described more strongly than its row, and the sentences after the card name "the two or three most important gaps" and "point to the table for the rest" (revised 2026-10-19 on Sidhant's call; was "name every unmet requirement"). "Every unmet requirement stays in its row and in `gaps`." A sentence that only names what the record doesn't show cites nothing. (3) "A ramp is what a hire learns on the job." A requirement no ramp closes (years, a certification, a degree, a location) is stated as a gap, and nothing predicts how fast he would close one. (4) "Ramp framing is only for a posting where the matches outweigh the gaps." When most rows are unmet, the summary says the core of the role is outside his record. The paragraph after them now opens "The summary is prose like any other". | One illustrative example. It is not said to visitors, but the model may echo it: strong on sales reporting and quarter-end close, with Salesforce administration and CPQ absent. | `content/knowledge/resume.md` (Nokia: sales reporting migration, the quarter-end reporting tool; no Salesforce administration or CPQ anywhere in the corpus). The policy is `docs/idea-decisions.md` §4, "Honesty and advocacy", and Opus review #9. |
| draft | `app/api/chat/route.ts` → the `roleFit` input schema, `verdict` description | **Model-facing, not on `/prompt`.** Tool schemas go to the provider, not to the page. "One line, under 25 words, a recruiter could read on its own: what matches first, then what the ramp would be. Never describes a requirement more strongly than its row, never opens with a grade, and when most rows are unmet says the core of the role is outside the record instead of calling it a ramp." Was "One line a recruiter could read on its own: where he fits, and what the real question is." | none | The prompt row above |

**Application links, 2026-10-19** (branch `worktree-agent-aa8fedc2a0a6a9df2`).
One `?ref=<company>` link per application, counted in PostHog and never shown on
the page, plus a short fit link that replays as a standalone page. The routine
is `docs/application-links.md`. No string here renders the ref.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `components/shell/app-shell.tsx` → `REPLAY_FIT_LINE`, first line of the replay banner when the replay holds a fit check | "A fit check: the assistant on Sidhant Mathur's site read one job posting against his record, citing a source for every match and listing the gaps." | one, about the site | `lib/role-fit.ts`: a `met`/`partial` row with no valid source is downgraded to `unclear`, and gaps can't come out empty while a row is `unmet`. Says nothing about his experience. |
| draft | `components/shell/app-shell.tsx` → `REPLAY_POSTING_LEFT_OUT`, appended to `REPLAY_BANNER` when the posting turn is the bare request line | "The posting itself is left out of the link; the table quotes the requirements it judged." | none | `lib/transcript.ts` → `toSnapshot` leaves the posting out; rows carry the posting's words (`role-fit.ts`, "The posting's words, not the site's"). |
| draft | `components/shell/app-shell.tsx` → replay banner | The three contact controls, "Download resume (PDF)" (filled, on a fit check) · "hello@sidhantmathur.com" + "copy" · "LinkedIn ↗", under the banner text and above "start a fresh one". New surface `replay` in `contact-actions.tsx`. | none | Wave 2's strings, unchanged; a new placement. |
| draft | `components/shell/app-shell.tsx` → ledger turn labels | A replayed turn reads "NN · asked"; a live turn is still "NN · you". | none | UI chrome. "you" over a fit check Sidhant sent put his request in the recruiter's mouth. |
| draft | `lib/transcript.ts` → `toSnapshot` / `fitSnapshot`, the replayed posting turn | A posting turn replays as the existing request line, "Here's a job description. Map my experience onto it, and be straight about where I don't match." | none | `JD_PREFIX` in `lib/job-posting.ts`, already sent ahead of every pasted posting. New placement, not a new string. |
| draft | `components/shell/shell-data.ts` → `fitExcerptNote`, over the requirement table (panel and print) when the counts cover more rows than are present | "Showing {n} of {total} requirements: the strongest cited ones. The counts cover all {total}, and every gap is listed below." With no rows: "This link carries the counts for all {total} requirements and every gap, but none of the rows." | none | Describes `fitSnapshot`'s selection, which is the scorecard's (`strongestRows`). |
| draft | `components/shell/export-deck.tsx` → "Short link" section (shown with a fit check) | Label "Short link". Note: "The same scorecard as a link, with the answer's summary — short enough for an application form or a plain-text email. The posting itself stays out of it." Buttons "build a short link" / "rebuild the short link", "copy the short link" / "copied"; then the link, "{n} characters", and the existing too-long warning past 2,000. | none | `fitPermalinkFor` in `lib/permalink.ts`; 1,635 characters on the recorded 3,891-character posting. |
| draft | `app/not-found.tsx` | "Read the resume →" (to `/resume`), beside "Head back home →". | none | UI chrome. Wave 2 leftover. |
| removed | `app/llms.txt/route.ts` | "/chat — Ask a question about my work directly." | — | `/chat` permanently redirects to `/` (`next.config.ts`); the `/` line already describes the chat. |

**The measurements refresh, 2026-10-20** (branch `claude/measurements-refresh-4015e1`).
Both pages read live runs from 2026-10-20 (UTC) on the five catalogue models,
scored by the citation checker as changed on 2026-10-19. July's runs stay on the
record under their own ids; three of those models are now marked retired. The
groundedness figure is relabelled, because "52.8% claims verified" read as "half
his claims are false". These rows replace the matching strings in the Sprint 6,
Sprint 8 and catalogue-refresh rows above.

| Status | Where | What it says | Claims | Grounding |
| --- | --- | --- | --- | --- |
| draft | `app/measurements/page.tsx` → live runs | Label "The models the chat offers now, latest run of each", over the current runs. Tag "default" beside the default model. Empty line, shown only when none of them has a run: "None of the models the chat offers now has a published run yet. The runs below were measured on models it offered before." | none | `splitArchive` in `lib/model-comparison.ts` picks the runs; `DEFAULT_MODEL` in `lib/models.ts` picks the tag. |
| draft | `app/measurements/page.tsx` → live runs, earlier | Label "Earlier runs", then "Kept under the model each one ran on. Retired means the chat no longer offers that model, and none of its results carries over to the one that replaced it." Each row has the model id, a "retired" tag when the catalogue no longer has it, the date, "{n}/{total} passed" and "{n} broke in transport". | none | `catalogueDrift` against `MODEL_IDS`. |
| draft | `app/measurements/page.tsx` → groundedness figures | The lead figure's label is now "found in the cited source", with the note "{v} of {c} checkable sentences" (was "claims verified" and "{v} of {c}"). Three new figures, shown when every counted run carries the verdict split: "found elsewhere in the record", note "in the record, under a different source"; "not found in the record", note "can include a sentence naming what the record lacks, or a word taken for a name"; "cited no source". "invented sources" and "answers checked" are unchanged. | none about Sidhant; describes the checker | The four verdicts in `lib/verify.ts` (`verified`, `miscited`, `unverified`, `uncited`). The "can include" note: all ten such sentences in the 2026-10-20 runs were read by hand (docs/followups.md §2, "The bake-off, 2026-10-20"). Seven name a requirement he lacks, and three open with "Strong", which the checker reads as a name. |
| draft | `app/measurements/page.tsx` → groundedness meaning | "The first figure is the share of sentences with a checkable name or number whose names and numbers the site's checker, a deterministic text match rather than a model, found in the source that sentence cited. It is not the share of statements that are true, and a sentence the checker could not match there is not thereby a false one." When the split is shown, it adds: "The figures beside it say where the rest were found, or that they weren't." | none | `checkClaim` in `lib/verify.ts`. |
| draft | `app/measurements/page.tsx` → groundedness sample line | "Measured on the latest run of each model the chat offers, {date range}, over the {groups} groups." (was "Measured on {model ids}, over the … groups."), with the groups now listed "a, b, c and d" rather than joined by "and" throughout. Then a label, "Found in the cited source, by model:", and one entry per model: "{model id} (default) {v} of {c}". If an offered model's latest run predates the checker change: "Not counted: {ids}, whose latest run predates the change described below." | none | `checkedByCurrentRules` in `lib/measurements.ts`. |
| draft | `app/measurements/page.tsx` → checker change | "The checker's rules changed on {19 Oct 2026}. A name or number found elsewhere in the record is now counted apart from one found nowhere, numbers match only as whole numbers, and a sentence that only names a gap is no longer checked." When there is a current figure, it adds: "Every run counted above was scored after the change." | none about Sidhant; three facts about the checker | Commits 0cd0372, 926eddf and f7d7439; the date comes from `CHECKER_REVISED`, the commit time of f7d7439. |
| draft | `app/measurements/page.tsx` → the earlier figure | "Runs from before the change were scored by the older rules, so they are kept apart rather than added in. The latest of those runs on each model found {v} of {c} checkable sentences in the cited source ({pct}), across {n} models measured {range}, and that figure does not compare with the one above." This is where the July figure, 66 of 125 (52.8%), is still published. | none | `groundedness(latestRunPerModel(runs before CHECKER_REVISED))`, the same arithmetic the old headline used. |
| draft | `app/measurements/page.tsx` → groundedness states | Empty state when only pre-change runs exist: "No run on a model the chat offers now has been scored by the current checker, so there is no current figure. Earlier runs are below, kept apart." The narrowness paragraph now opens "Found in the cited source means…" (was "Verified means…"); the rest is unchanged. | none | — |
| draft | `app/measurements/models/page.tsx` → metadata description | "The five models this site's chat offers, measured against the same eval corpus: pass rate, time to first token, output speed, tokens and cost per task." (was "Five models this site has run…"). | none about Sidhant; one about the site | `MODEL_IDS` has five entries; all five have a run from 2026-10-20. |
| draft | `app/measurements/models/page.tsx` → intro | "…This page is what happened when the ones it offers now answered the same 22 questions, in the same order, against the same server, in one sitting — graded by the same checker, and costed at list price." (was "the five it ran at the time … on the same afternoon"). | none about Sidhant; one about the site | The six runs of 2026-10-20 ran back to back against one local production server, 02:27–02:47 UTC. |
| draft | `app/measurements/models/page.tsx` → archive note (replaces the catalogue note) | "Earlier runs are kept in the archive at the end of the page, each under the model it ran on. None of their figures carries over to a successor, and none is in the charts." then "Retired, measured earlier: {ids}." (was "Measured here, no longer offered: {ids}."). "Offered now, not measured yet: {ids}." is unchanged. Empty state when no offered model has a run: "None of the models the chat offers now has a published run yet, so there is nothing to compare. Earlier runs, on models it offered before, are in the archive below." | none | `splitArchive` and `catalogueDrift`. |
| draft | `app/measurements/models/page.tsx` → archive | Intro rewritten: "…Before the archive existed a second run on a model overwrote the first… Runs are now kept. The charts above read the most recent run of each model the chat offers; a retired model is one it no longer offers, and its runs stay here under its own id." (was "Until this sprint…" and "the charts above read the most recent per model"). Tags "default" and "retired" beside a model. Two runs of one model on one day read "{date}, {hh:mm} UTC". "shown above" now marks the charted run rather than the newest one. | none | `runHistory`, `splitArchive`. |
| draft | `app/measurements/models/page.tsx` → table | Column "in cited source" (was "claims verified"). Note: "…"in cited source" is the site's own citation checker run over that model's answers: the sentences whose names and numbers it found in the source they cited, out of the sentences with something checkable in them. It is not a count of true statements; the groundedness section says where the rest were found." The last phrase links to /measurements. | none | `lib/verify.ts`. |
| draft | `app/measurements/models/page.tsx` → "What this does not measure" | "One sample per case" now opens "In the run charted here, each model answered each question once." Its last sentence, "…would move these numbers, and nothing here says by how much", is split: "…would move these numbers." then, when a charted model ran more than once that day, a computed line "{name} was run twice on {date}, and passed {a}, then {b} of {total}: the only spread this page has, on one model.", and otherwise "Nothing here says by how much." Latency: "…at that hour" (was "that afternoon"). Costs: adds "DeepSeek V4 Flash's rate is unconfirmed: the Gateway serves it through many providers whose rates differ several times over, and the meter cannot see which one billed a turn." Then "Archived runs keep the rates of their day, and two of those have since been corrected: gpt-5.6-luna's July run was costed at…" (the Luna and Gemini facts are unchanged). Broken turns: "But one sitting's requests are a thin basis for a reliability claim: it says a model dropped streams here, then, not that it drops them at that rate everywhere." (was "one afternoon… one in four everywhere"). | none about Sidhant; price and run facts | DeepSeek: the `deepseek/deepseek-v4-flash-0731` row in `lib/models.ts` (fifteen providers, $0.02–$0.44 input). The repeat line is computed from the archive. |
| draft | `app/measurements/models/page.tsx` → new caveat | Title "Each model runs the way the chat runs it". Body: "Each model answered with the settings the chat gives it, so this measures the site as a visitor would meet it, not each model at its best." Then a computed line from the catalogue, today "GPT-6 Luna reasons at low effort on a pasted job posting. Everything else runs at the provider's default." | none about Sidhant; one about the site | `reasoningFor` in `lib/models.ts`; the route sends that level (`b914bf6`). |
| draft | `app/llms.txt/route.ts` | "/measurements/models — The five models this site's chat offers, compared on one corpus: pass rate, latency, tokens and cost per task." (was "Five models this site has run…"). | none about Sidhant; one about the site | Same as the metadata row. |
| draft | `app/measurements/models/page.tsx` → cost frontier note | Appended when a charted run's Gateway bill differs from its list-price total: "{name}'s run billed {x} times its list-price total on the Gateway, so plotted by its bill its dot would sit further right. The note on list prices below has the figures." Today: DeepSeek V4 Flash, 3.3 times. | none about Sidhant; one billing fact | `GATEWAY_BILLED_USD` in the page, keyed to each run's model and start time; the credit readings are in `docs/followups.md` §2, "The bake-off, 2026-10-20". |
| draft | `app/measurements/models/page.tsx` → "Costs are list prices, not an invoice" | Appended when every charted run has a bill on record: "For the runs charted here, the Gateway's own bill matched the list-price total for every model but {name}, whose run billed {$billed} against {$list} at list price." Today: DeepSeek V4 Flash, $0.0368 against $0.0113. If none differs: "For the runs charted here, the Gateway's own bill matched every model's list-price total." | none about Sidhant; billing facts | Same as above. |
| draft | `components/shell/app-shell.tsx` → conversation bar | A title bar over every conversation: a bordered "← Home" button, then "Your conversation" (or "Shared conversation" on a replayed link; hidden on phones), then "{n} of 10 questions". Home goes to the front page and keeps the conversation to continue. | none | `MAX_USER_MESSAGES` in `lib/models.ts` |
| draft | `components/shell/app-shell.tsx` → continue row | On the front page when a conversation was left by Home, a reload or Back: "↩ Continue where you left off", "· {n} questions" (from sm), "or ask something new to start over" (from lg), and "clear" (accessible name "Clear the saved conversation"). | none | `saved` in `use-conversation.ts` |
| draft | `components/shell/app-shell.tsx` → conversation full | Under the tenth answer: "That's 10 questions, the most one conversation holds. Start a new one to keep asking — this one stays saved on the front page." Button "Start a new conversation". The composer's placeholder becomes "This conversation is full". Replaces the hourly-budget state that used to answer the cap with "You've hit the message limit for now", which told the visitor to wait for something a new conversation fixes at once. | none | The route's 429 for `userMessageCount > MAX_USER_MESSAGES`, now enforced in `submit` before the request |
| draft | `lib/chat-telemetry.ts` → `TURN_FAILURES.interrupted` | Label "unfinished"; sentence "This question never got a full answer — the conversation was left, or the turn failed, before it finished." Shown, with "try again", when a saved conversation comes back ending on a question with no answer or half of one. | none | `endsUnanswered` in `use-conversation.ts` reads the turn record's closing write |
| draft | `lib/refusals.ts` → `storage.instead` | "The conversation lives in your browser until you clear it from the front page." (was "until you reset it"). | none | `clearSaved` in `use-conversation.ts` |
| removed | `components/shell/app-shell.tsx` → actions strip | "reset", the strip's last action. It was the only way out of a conversation, a faint word in the bottom corner that deleted the conversation outright. Replaced by Home in the conversation bar (2026-10-19). | none | — |

## Pending `[VERIFY]` markers

Sentences drafted with a fact-shaped hole in them, waiting on Sidhant. Listing them
here means a `[VERIFY]` left in a file can't quietly ship.

| Where | What's needed |
| --- | --- |
| `content/adarle20-media.ts` → `FEATURE_SURFACE_NOTE` (not rendered since wave 1, 2026-10-19; it goes back on `/projects/adarle20` once resolved) | **The features of A Darle 20 that appear in no source file.** The list on the page is the dozen the record names; the note says so out loud. To resolve it: write the missing capabilities into `content/knowledge/projects-adarle20.md` — one line each is enough — and they can then be added to the surface and checked by the suite like the rest. Reviews and ratings are visible in the one screenshot the repo has and are still *not* on the list, because a screenshot is not the record. |
| `content/knowledge/faq.md` → "What is he not looking for?" | Held out of the system prompt, `/prompt` and the chunk index by `scripts/build-knowledge.mjs` since wave 1 (2026-10-19), until it has an answer; the chat now has nothing on the question rather than a marker. Pre-existing, untouched by Track B, and now more visible than it was: the recruiter chips and the TL;DR both point a reader at what he *is* looking for, and the corpus has nothing for the other half of that question. |
| `docs/site-copy.md` → Colophon | "[TODO: confirm repo is public before linking]". Cut from `/colophon` with its sentence in wave 1. The repo IS public, and so is `docs/` (the ledger, the decisions doc, dictated notes). Decision for Sidhant: link it, or move `docs/` out first. |
| `content/adarle20-media.ts` → `ADARLE_MEDIA`, the six slots with no `asset` | Not rendered since wave 1. Each slot's brief says what file it needs; a slot appears on `/projects/adarle20` the day its `asset` is filled in. |
| `content/projects.ts` → Dell card stack | Did the Dell work use Python? The card said so; `content/knowledge/projects-dell.md` doesn't. Removed in wave 1 until confirmed. |
