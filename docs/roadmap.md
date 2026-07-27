# Roadmap — the order to build the 28 in

Companion to `docs/idea-decisions.md`. That doc says **what** and **why**; this one
says **in what order** and **done means what**. It deliberately does not restate
rationale — items are referred to by their number there (`#11`), and bank §6 stages
by name (`S1`). If you want to know why something is on the list, read the other doc.

Two things were added that aren't in either doc, because sequencing surfaced them:
**F1–F3**, foundations that several accepted items silently depend on. They are not
new features. They are the parts of accepted features that have to exist first.

Status: **approved 2026-07-27.** Sprints 1, 2, 3, 4 and 5 are built and green —
see the results notes under them. Sprints 6–7 and Track B are unspecced and
unbuilt. The open question at the bottom (#4) was resolved on 2026-07-27 and shipped in
Sprint 3 as a post-hoc "sources touched" row.

---

## If you've been told "start sprint N"

This doc is your brief. Before planning:

1. **Read `docs/idea-decisions.md`** for the why behind every numbered item in your
   sprint, and especially **§4 — the four standing policies.** The instrumentation
   one ("ambient around the conversation, never in front of it") and the copy one
   (log every drafted string, never invent a fact about Sidhant) constrain most of
   this list. Read bank §6 too if your sprint mentions an `S`-stage.
2. **Verify the code before trusting this doc.** The findings below were true on
   2026-07-27 and earlier sprints have moved things since.
3. **Work on a feature branch**, atomic commits, and `npm run build` at zero errors
   before the sprint is done — all three are `CLAUDE.md` rules, not suggestions.
4. **Stay inside your sprint.** If you find work that belongs to a later one, note
   it and leave it. The order below exists because of real dependencies.

**Track A sprints are sequential and they contend for the same two files**
(`app/api/chat/route.ts`, `components/shell/app-shell.tsx`). Don't run two of them
at once. Track B is the only branch safe to run in parallel with anything.

---

## The shape

**Track A** is sequential — each sprint depends on the one before it. **Track B**
runs alongside from day one: static pages, copy, and media, gated on Sidhant's
review rather than on code, and it touches almost none of the same files.

```
Track A   S1 Spine → S2 Instruments → S3 Grounding → S4 JD flow → S5 Export → S6 Measurements → S7 Recursion
Track B   ────────────── project pages, recruiter copy (parallel, copy-gated) ──────────────
```

---

## What grounding the plan in the code changed

Four facts from `app/api/chat/route.ts` and the client shell as of 2026-07-27.
They are why the sprint order is what it is, and two of them are load-bearing
enough to need a decision from Sidhant.

**1. There is no retrieval.** `buildSystemPrompt()` concatenates the entire 11.3 KB
knowledge base into the system prompt on every request, byte-identical so the
Anthropic prompt cache hits. There is no vector store, no chunking, no per-turn
selection. **#4 retrieval flicker has nothing to flicker.** See the open question
below — this one needs Sidhant.

**2. Nothing is citable yet.** `CITATIONS` has stable ids, but they're parsed from
`resume.md` only, at section granularity, and **the model never emits one** —
`roleFit.matches[].evidence` is free text with no anchor. #12 (marginalia), #21
(citation enforcement), and S1's "a row that cannot cite is downgraded by code"
all require the model to emit ids against a chunked corpus. That's F2, and it
gates a whole sprint's worth of accepted items.
*Closed by Sprint 3 for prose: the whole corpus is chunked as `CHUNKS`, the model
emits ids, and `lib/verify.ts` checks them. Closed by Sprint 4 for the job-
description flow: every assessment row carries `sources`, and a row that claims
a fit and cites nothing valid is downgraded by `lib/role-fit.ts`.*

**3. The only side-channel to the client is four HTTP headers.** No data parts, no
`messageMetadata`, no `createUIMessageStream`. #1, #3, #5, #6, #22 and #23 all read
per-turn numbers that currently never leave the server. That's F1.

**4. The chrome is further along than the idea list assumes.** A status strip
(turns, TTFT, budget, model select), a left rail, a resizable context panel, and a
slash-command popover with four commands already exist. So **#27 is mostly a
re-tenanting job, not a new surface**, and **#13 is extending a registry, not
building one** — both are cheaper than the decisions doc implies, and #13 no longer
needs to wait for everything it points at.

---

## Track A

### Sprint 1 — The spine
*Invisible. Six accepted items are blocked on it, and one live bug is sitting in the JD flow.*

| | Work | Unblocks |
| --- | --- | --- |
| F1 | Per-turn telemetry channel: move to `createUIMessageStream` and emit model, input/cached/output tokens, TTFT, tokens/sec, step count, and a typed error class as data parts. Client keeps a per-turn record. | #1 #3 #5 #6 #22 |
| F3 | Widen the 7-name `AnalyticsEvent` union to cover latency, model, error class, cache hit. | #23 |
| — | **Fix the JD tool abandonment** (S0's actual finding: the model drops `roleFit` entirely on the postings it's least qualified for). Force the tool call for JD turns; test across the allowlist before assuming it's a prompt problem rather than a small-model one. Finish the four unrun adversarial S0 cases. | #11 #21 S1 |

**Done means:** every answer carries a complete telemetry record the client can read; `npm run eval:live -- --group roleFit` calls the tool on all five postings across at least three models; `npm run build` clean.

**Why F3 is here and not in Sprint 6:** #23 aggregates PostHog history at build time. The events have to be emitting for weeks before that page has anything to show. Ship the emitters now, build the panel later.

#### Sprint 1 results — 2026-07-27

**Done.** All three acceptance criteria met. Full live corpus green on the
default model (21/21), `roleFit` tool called on **5/5 postings across three
models**, `npm run build` and `npm run lint` clean.

What shipped: `lib/chat-telemetry.ts` (the shared record and error-class
vocabulary), the route on `createUIMessageStream` writing one reconciled
`data-turn` part per turn, `lib/job-posting.ts` (the detector), `prepareStep`
forcing `roleFit` on step 0 of a posting turn, and two new analytics events.

Three things worth carrying forward:

1. **The JD bug was two bugs.** Forcing the tool call fixed the first. The
   second only appeared on `openai/gpt-5-mini`, which failed three of five
   postings with `finishReason: "length"` and nothing to show — a reasoning
   model spending the per-step output budget on reasoning tokens before it
   emits the forced tool call. Raising the JD ceiling to 2500 fixed it (5/5).
   The roadmap's instruction to test across the allowlist before blaming the
   prompt is the only reason this was found; on the default model it is
   invisible.
2. **The eval harness was scoring transport failures as model judgment.** A
   mid-stream failure returns HTTP 200 with an error chunk, and the runner read
   only text and tool names — so a broken turn arrived as an empty answer and
   scored as "did not call the roleFit tool". That is exactly the bug this
   sprint was chasing, wearing its face. The runner now reads error chunks,
   marks those turns `BROKE` rather than `FAIL`, prints the finish reason, and
   records the whole telemetry record per case.
3. **One gap-naming assertion still fails**, on both haiku and gemini, in
   different places: haiku doesn't name the 8+-years shortfall on `ml-infra`,
   gemini doesn't name on-call on `eng-manager`. Both call the tool and both are
   honest; they just don't cover every labeled requirement. **This is Sprint 4's
   `requirementTable`** — a per-requirement verdict forces a row for every line
   in the posting, which is the structural fix. Left alone deliberately; the
   patterns were not loosened to make it green.

Also added: a fifth posting (`gtm-engineer-partial`) so the corpus matches the
five this sprint's criterion names, and static tests asserting the detector
fires on every posting and on none of the ordinary questions.

**Not done, and out of scope by design:** nothing renders any of this. `turnLog`,
`telemetry`, and `errorClass` come out of `useConversation` unused. That's
Sprint 2's job — the sprint is called invisible on purpose.

---

### Sprint 2 — The instruments
*Pure consumers of F1. Highest visible payoff on the list, and low risk because nothing here changes what the model does.*

**#1** cost meter (the single home for turns, dollars, cached input, session cumulative, privacy framing) · **#5** tokens-per-second seismograph · **#3** glass-box trace inspector · **#6** failure theatre (F1's error classes, forced) · **#16** teletype audio, off by default · **#14** idle mode

**Done means:** a visitor who ignores every readout still has a working chatbot (§4 instrumentation policy); no instrument adds a step, mode, or decision to the main path; #14 and any #1 copy logged in `docs/copy-ledger.md`.

#### Sprint 2 results — 2026-07-27

**Done.** All six items shipped and all three acceptance criteria met. `npm run
build`, `npm run lint` and `npm run eval` (62/62) clean.

The shape it took: **the always-visible half is four numbers in the status strip
that already existed** — turns, latency, a seismograph, session dollars — and
**the dense half opens in the context panel that already existed**, on a click.
Nothing new appears in the message column and nothing was added to the page to
advertise the instruments; the readouts are their own affordance. That is the §4
policy taken literally, and it also meant the sprint added one panel view rather
than a surface.

What shipped: `lib/pricing.ts` (the list-price table and the turn arithmetic),
`components/shell/instruments.tsx` (the deck — cost meter, seismograph, trace
inspector, failure theatre, teletype toggle), three hooks
(`use-token-rate.ts`, `use-teletype.ts`, `use-idle.ts`), a `?simulate=` branch in
the chat route, and `evals/instruments.test.mjs`.

Five things worth carrying forward:

1. **Two numbers for one measurement, kept apart on purpose.** The seismograph
   needs a rate *while* the answer streams; the server's exact figure only
   arrives when the turn ends. So the live needle is sampled client-side from
   the growth of the text and rendered with a `≈`, and the settled number —
   F1's, from the provider's own usage — renders without one. Same for TTFT,
   where the trace shows the server's and the browser's side by side rather than
   reconciling them. On a site whose argument is that its instruments are
   honest, collapsing an estimate and a measurement into one figure would have
   been the cheapest possible way to lose that argument.
2. **The failure theatre is a real exit, not a mock.** `?simulate=<class>` takes
   the same route out as the real thing — `jsonError` for the three early
   classes, an actual throw inside `createUIMessageStream` for the five
   mid-stream ones — so a simulated timeout really does arrive as an HTTP 200
   whose stream ends in an error chunk. It calls no model and consumes no
   budget, which is what makes it safe to leave on in production, and it is
   failure-only: it cannot produce an answer, and an unrecognised value falls
   through to a normal turn. Three static tests keep the class list, the route's
   cases, and the panel's buttons in step.
3. **The price table is the soft spot, and it's marked as one.** Input and output
   prices come from the ones already recorded against each model in `route.ts`.
   The cache-read and cache-write prices are *derived* — each provider's
   published discount applied to that model's input price, not separately
   checked figures. Everything says "est. at list price", `lib/pricing.ts` says
   which numbers are which, and an unpriced model renders "—" and is excluded
   from the session total rather than being counted as free. **Worth a check
   before #23 or #2 publish any of it.**
4. **A tool call no longer steals the panel — but only from the deck.** Every
   other view still gets replaced by tool output as before. Having the
   instruments yanked away mid-reading made them feel like they belonged to the
   model rather than the reader.
5. **#15 was not pulled forward.** The roadmap flags it as a candidate if
   rate-limiting shows up in real traffic. Failure theatre now makes the
   rate-limited state reproducible on demand, so the question of whether it's
   worth building is answerable from the PostHog `chat_rate_limited` counts
   rather than from a guess. Left in Sprint 7.

**Not done, and out of scope by design:** the seismograph estimates tokens at
four characters each, which is wrong in both directions on code and on names —
that's why it's an `≈` and not a fix. Idle mode fires at 90 seconds with no
research behind the number. The rate-limit copy under #6 is the existing string,
not new copy for a visitor who deliberately pressed a failure button.

---

### Sprint 3 — Grounding
*The deterministic backbone. Everything about honesty downstream reads from this.*

| | Work |
| --- | --- |
| F2 | Chunk the knowledge base into stable addressable ids (currently one opaque string), extend `CITATIONS` past `resume.md` to the whole corpus, expose the id vocabulary to the model, and require id emission on claims. |
| #21 | Verified claims — non-LLM post-pass checks the cited chunk actually contains the claim's numbers and proper nouns; failures render as unverified. |
| #12 | Citations as marginalia. |
| #4 | Retrieval flicker — **blocked on the open question below.** |

**Done means:** a claim without a valid chunk id is downgraded by code, not by the model's judgment; the downgrade path has an eval case.

#### Sprint 3 results — 2026-07-27

**Done.** Both acceptance criteria met. `npm run build`, `npm run lint` and
`npm run eval` (94/94) clean; live corpus green on the default model — grounded
6/6, refusal 4/4, injection 6/6, roleFit 4/5 (see 4 below).

Spec: `docs/sprint-3-grounding.md`. What shipped: the build script cuts all six
knowledge files into **29 chunks** with `<source>:<slug>` ids and renders those
ids into the knowledge base itself; `lib/verify.ts` (the deterministic
post-pass); `components/shell/answer.tsx` (margin, sources row, downgrade
marks); a panel view for a cited chunk; `evals/citations.test.mjs`.

Five things worth carrying forward:

1. **The id lives on the line above the text it names.** There is no separate
   list of ids in the prompt, because a list is a thing that can fall out of
   sync with the corpus. The same rendering produces both the prompt and the
   chunk data, so the ids the model is shown, the ids the panel can open, and
   the text the checker searches are one artifact. Both directions of that are
   asserted in the static suite.
2. **The chunk's checkable text has to be exactly what the model read.** The
   first live run flagged "A Darle 20" as unverified against an A Darle 20
   chunk: the label line was in the prompt and not in the haystack. Every gap
   between what the model sees and what the checker searches surfaces as a
   *false* unverified, which is the most expensive way this feature can be
   wrong — a mark on a correct sentence teaches the reader to ignore all of
   them.
3. **Calibration was most of the work, and it is pinned.** Live runs produced
   false flags on discourse markers ("First," "Specifically,"), a trailing
   comma inside a number, derived forms ("Mexican" against "Mexico"), an
   abbreviated month ("March" against "Mar 2026"), and the closing question
   every answer ends with. Each fix has a test in "false alarms the live corpus
   produced", so the next person to touch the tokenizer finds out immediately.
   Leniency runs one way on purpose: this thing reports absence, and a
   near-miss must never become an accusation.
4. **The JD flow doesn't cite, and that's Sprint 4's.** Ordinary answers cite
   well (9/11 claims verified on the grounded group, and both remaining flags
   were real miscitations). Job-posting turns cite almost nothing — 1/12 across
   five postings, unchanged after two prompt nudges. The model writes its
   closing summary off the `roleFit` object it just produced rather than off
   the corpus. Rather than special-case it, an answer that cites *nothing* now
   renders one quiet line instead of a mark per sentence; the real fix is a
   `sources` field on the schema, which is Sprint 4's `requirementTable` work.
   The roleFit 4/5 is the known gap-naming assertion from Sprint 1 — it moved
   from `ml-infra` to `eng-manager` between runs on the same model, which is
   the flakiness Sprint 1 recorded, not a regression.
5. **`verified` is a narrow word and the copy keeps it narrow.** It means the
   numbers and names in this sentence appear in the chunk it cited — not that
   the sentence is true, and not that unmarked prose was checked. Sentences
   with nothing checkable in them are not claims and are not counted. Anyone
   rewriting these strings should read the note in `docs/copy-ledger.md` first:
   upgrading them to a truth claim would assert more than the code can support.

**Not done, and out of scope by design:** `roleFit` has no citation field (see
4). Nothing publishes an aggregate groundedness rate — that's #22, gated on #2.
The checker only reads numbers and proper nouns, so "he likes owning the
result" is invisible to it, deliberately. Exported transcripts strip markers
and append a bare `Sources:` line; rendering them properly in an artifact is
#17.

---

### Sprint 4 — The JD flow, honest by construction
*Bank §6's critical path. S1 and #11's `requirementTable` are one piece of work seen from two ends — built together, per the decisions doc.*

**S1** `gaps` required with `noGapsRationale`; per-requirement `met`/`partial`/`unmet`/`unclear`; citation-or-downgrade (uses #21); extraction split from judgment · **#11** the generative-UI component vocabulary, `requirementTable` first · **S2** posting-as-hostile-input hardening

**Done means:** S0's soft-pedal and gap-naming assertions pass; the injection cases pass; `requirementTable` renders without implying arithmetic precision it doesn't have (the rendering constraint from decisions §3).

#### Sprint 4 results — 2026-07-27

**Done.** All three acceptance criteria met. `npm run build`, `npm run lint` and
`npm run eval` (125/125) clean; live corpus green on the default model —
**roleFit 6/6**, grounded 6/6, refusal 4/4, injection 6/6 — and **roleFit 6/6 on
`openai/gpt-5-mini` and `google/gemini-3.5-flash-lite` as well**. The gap-naming
assertion that failed in Sprint 1 and again in Sprint 3 now passes, on every
posting, on all three models.

Spec: `docs/sprint-4-jd.md`. The shape it took: **a job-posting turn is three
forced steps** — extract the requirements verbatim, judge them, then write the
sentence — and **`lib/role-fit.ts` decides what a reader finally sees**. Every
extracted requirement gets a row whether the model wrote one or not; a row
claiming a fit and citing nothing valid is downgraded to `unclear` by code; gaps
cannot come back empty while an `unmet` row exists. What shipped besides that:
`checkClaim` lifted out of `lib/verify.ts` so a row is checked exactly like a
sentence of prose, the posting fenced and re-asserted with a deterministic
injection pre-pass (`lib/job-posting.ts`), the `requirementTable` renderer in
the context panel, and `evals/role-fit.test.mjs` (31 cases).

Five things worth carrying forward:

1. **The schema was the bug, twice, and both times it cost the whole
   assessment.** The first live run failed four of six postings with a tool
   input-validation error: both halves of the turn are in one context, the
   extraction filled a field called `requirements` with strings, and asked for
   a field of the same name the model handed back the same array. Renaming it
   to `rows` fixed most of it; the next run still lost one posting because the
   object arrived under `requirements` anyway. **The rule this settles: nothing
   in a tool schema may reject a generation.** The field is optional, its
   alias is accepted, `verdict` is a plain string, and a bare string is a valid
   row. Enforcement moved entirely into the reconciler, where failing means a
   marked row instead of an answer with nothing behind it — which is Sprint 1's
   lesson arriving by a new road, and it now has a static test.
2. **Coverage is what fixed gap-naming, not better prompting.** Both models in
   Sprint 1 wrote honest assessments that skipped exactly one labeled
   requirement. Nothing about that is fixable by asking harder. Extracting the
   list first and having code fill in the rows the judgment skipped makes the
   omission structurally impossible — and when it happens the reader is told
   *the assessment didn't answer this one* rather than seeing nothing.
3. **A citation can only be demanded of a positive claim, and the checker can
   only read presence.** `unmet` rows cite nothing because an absence has no
   chunk to point at; requiring one would make "claim it instead" the cheapest
   way to satisfy the checker. And a row whose sentence names what's *missing*
   has names in it that aren't in the corpus by construction — the first run
   put unverified marks on seven of the most honest rows in the table. So a
   `met` row is checked whole, a `partial` row up to its first negation, and an
   `unmet` row not at all.
4. **Two real false alarms in the prose checker, found by this flow and fixed
   there:** `TypeScript/Next.js` and `LLM-integrated` were flagged against
   chunks that write those words apart. A compound now contributes its
   capitalized parts as separate tokens; the lowercase halves ("to",
   "integrated") assert nothing and are dropped. Both directions are tested in
   Sprint 3's "false alarms the live corpus produced" block.
5. **The extra step cost tokens where Sprint 1 said it would.** `gpt-5-mini`
   failed one posting on `finishReason: "length"` with 2,496 output tokens and
   nothing emitted — the whole ceiling spent on reasoning before the EXTRACTION
   call, one step earlier than Sprint 1's version of this. The JD ceiling went
   2500 → 4000 and it went 6/6. Testing across the allowlist is what found it,
   again; on the default model it is invisible, again.
6. **The guarantees are visibly load-bearing on other models.** Gemini's run
   shows them working rather than idle: on one posting it judged one of six
   extracted requirements and code filled in the other five as unanswered, and
   on another it produced two rows claiming a fit with nothing cited, which
   were downgraded. On the default model both counts are usually zero — which
   is exactly why they're reported per run rather than assumed.
7. **The posting-borne injection is in the eval corpus now**, not just the
   defense. `injected-posting` carries a dictated verdict, suppressed gaps, a
   fake system line and a persona swap, and passes: the Kubernetes requirement
   still comes back unmet and none of the dictated language appears. Worth
   knowing before hardening further — the prompt survived it on the first run,
   as it did the six adversarial cases in Sprint 1.

**Not done, and out of scope by design:** the closing prose after a
job-posting turn still cites almost nothing (Sprint 3's finding 4, unchanged) —
the rows carry the provenance now, so the assessment is grounded even when the
sentence under it isn't, and an answer that cites nothing still renders one
quiet line rather than a mark per sentence. Export, scorecard and permalink are
Sprint 5's; nothing publishes per-model pass rates yet (#2, Sprint 6). The
soft-pedal detector is still report-only, and reported zero on the final run.

---

### Sprint 5 — Export and forward
*Everything here needs a conversation and a JD result worth exporting.*

**#17** one export surface — markdown, typeset print/PDF, permalink · **#18** URL-fragment permalink with the replayed-conversation banner · **#24** scorecard as an option inside #17 · **S3** folds in here rather than duplicating · **#13** extend the slash registry (`/budget`, `/sources`, `/pdf`) now that the targets exist · **#27** re-tenant the existing chrome as the persistent actions strip, with the post-action emphasis

**Done means:** `lib/transcript.ts` extended, not replaced; every export path tested against the 10-turn cap; the dependency added for PDF/docx named and justified per `CLAUDE.md`.

#### Sprint 5 results — 2026-07-27

**Done.** All three acceptance criteria met. `npm run build`, `npm run lint` and
`npm run eval` (**157/157**, up from 125) clean. No live run: nothing this
sprint changes what the model does or what the prompt says, so `eval:live`
would have re-measured Sprint 4.

Spec: `docs/sprint-5-export.md`. The shape it took: **one panel view with four
handles on the same conversation** — markdown, a file, a printed document, a
link — plus the scorecard when there is an assessment to make one from, and
**the controls that were already wedged into the input row became the strip**.
What shipped: `lib/transcript.ts` extended with the snapshot format, the
scorecard and the mail body (the existing serializer is untouched);
`lib/permalink.ts`; `components/shell/export-deck.tsx`;
`components/shell/print-sheet.tsx`; a print block in `app/globals.css`; the
replay path in `use-conversation.ts`; a corpus index in `panel-body.tsx`; four
new slash commands; and `evals/export.test.mjs` (32 cases).

Six things worth carrying forward:

1. **The PDF dependency is none, and that is the decision.** The roadmap asked
   for whatever got added to be named and justified; nothing did. The browser's
   own print pipeline produces a real PDF at the reader's paper size with
   selectable text and working links — everything a canvas-to-PDF library
   re-implements worse for ~200 kB — and `CompressionStream('deflate-raw')` is
   native, so lz-string isn't needed either. There is a static test asserting no
   PDF/compression dependency has appeared since.
2. **Print is two containers, and the first version was silently broken.** The
   shell carries `screen-only`, the document carries `print-only`, and print
   swaps which one exists. The document was originally rendered *inside* the
   shell — which meant it was inside the element print hides, so every print
   would have come out blank. Nothing about that is visible on screen, and no
   static test would have caught it; it took emulating print media in a real
   browser. **Whoever touches the print path should do the same.**
3. **`pushState` was eating the conversation.** `usePanelUrl` pushed a bare path
   on every panel change, and a bare path drops the fragment — so opening a
   citation while reading a permalink erased the permalink, invisibly, and only
   discoverably by reloading. The panel owns the path and has no opinion about
   the fragment now, and `panelHref` is the seam.
4. **A replayed conversation is never persisted.** Someone opening a link has
   their own conversation in that browser, and replacing it with a stranger's
   is the rudest available reading of "no storage". The replay lives in memory
   until the tab closes or the reader presses "start a fresh one", which also
   drops the fragment. The cost: continuing a replayed conversation is not saved
   across a reload either, which is a real if small surprise.
5. **The length estimate in the decisions doc didn't cover the case that
   matters.** It measured ordinary transcripts, and it holds: nine
   question-and-answer pairs encode to well under the 2,000-character mark, and
   there's a test pinning that. But a turn carrying a 3.5 kB pasted posting and
   a full requirement table cannot compress into a tweet, and no amount of
   arguing changes it. So the surface **prints the real character count** and
   flags it when it passes the length mail clients cut — Fable #14's joke turned
   out to be the honest instrument. The permalink is still storage-free and
   still needs no dependency; it just isn't uniformly small.
6. **The scorecard shows only rows that cite something.** The section is called
   evidence, and an `unmet` row has nothing to point at by construction (Sprint
   4's finding 3). Those rows are not lost — every gap travels, uncut, in every
   transport, and there is a test per transport asserting it. That assertion is
   the one in this suite that is about honesty rather than about formatting.

**Not done, and out of scope by design:** no `.docx` (markdown pastes into
every tool a recruiter uses and the print document covers the attachment case);
no file upload or URL fetch (bank §6 Stage 4); no derived artifacts — questions
from `unclear` rows, ramp plans, the cover-note draft that needs Sidhant's
explicit blessing (Stage 5); no comparison mode (Stage 6); no published pass
rates (#2, Sprint 6). `/model` is still not a slash command: it needs an
argument and the registry has no parser, so it would be a fifth panel or a lie.
The strip's touch targets are 32 px tall — under the 44 px iOS asks for, and the
same trade the header made in Sprint 4's mobile pass, so it wants a human's eye
rather than another agent's opinion. And the print document has had exactly one
pair of human eyes on it, in a headless browser: **paper is the one output here
that nothing in CI can check.**

---

### Sprint 6 — Publish the measurements

**#2** published eval suite — needs `npm run eval` to emit machine-readable output first; today the static layer only prints TAP · **#23** latency and reliability panel, aggregated at build time from the F3 events · **#22** groundedness self-report with calibration, **gated on #2** per the decisions doc

---

### Sprint 7 — The site talking about itself

**#7** publish the system prompt · **#8** index the repo as a second corpus · **#9** roast this site (needs #8) · **#10** refusal ledger (hand-curated content) · **#15** manual mode — meet the cached me on rate limit

**Pull-forward candidate:** #15 is the only item here that fixes a hole rather than adding a surface — a rate-limited visitor currently gets an error state. If that's happening in real traffic, move it to Sprint 2.

---

## Track B — parallel, copy- and asset-gated

Independent of the chat spine, touches static pages, and moves at the speed of
Sidhant's review rather than the build. Can start immediately.

**#19** expand the Adarle 20 project page — screen recordings, video, screenshots, the buried feature surface. The one item that's mostly not an AI feature, and the one that needs **assets from Sidhant** before an agent can do much. · **#20** explain-like-I'm-five as static build-time prose on project pages · **#25** TL;DR for recruiters above the fold · **#26** recruiter-tuned question chips — the chips already exist, so this is a copy swap

Every string here goes in `docs/copy-ledger.md`, and no fact about Sidhant gets
invented — `[VERIFY]` instead of a plausible guess.

**One conflict to watch:** #26 touches the same component as Sprint 2's instrument
work. Sequence it after Sprint 2 or accept a small merge.

---

## #4 retrieval flicker — resolved 2026-07-27

There is no retrieval to visualise, so the flicker as filed can't be built honestly.
**Sidhant's call: reframe it as a "sources touched" readout** — after the answer
lands, light up the chunks it actually cited. Not a flicker; a settle.

Two consequences for whoever builds Sprint 3: it is **free**, because it renders
F2's citation ids rather than adding a retrieval step, and it must stay
**post-hoc** — no animation implying a search happened before the answer, because
none did. Rejected: building real retrieval (breaks the byte-identical prompt cache
that makes every turn cheap, and #1 would show the damage), and cutting it.

---

## How the work gets specced

Not all at once. The decisions doc's own instruction — plan one cluster at a time,
because the list has real dependencies and a plan-everything document is stale
before it ships.

Per sprint, at the point we start it:

1. **A sprint spec** — intent, acceptance criteria, constraints, explicitly out of scope. One page. Not an implementation plan; it doesn't name files or functions, because those move.
2. **One agent per item.** It reads the spec, plans against the code as it actually is that day, implements, and gets `npm run build` to zero errors. The plan is the agent's working artifact, not a document for review.

This roadmap holds order, dependency, and acceptance criteria only. It doesn't
duplicate the decisions doc, and it won't grow into a third source of truth.
