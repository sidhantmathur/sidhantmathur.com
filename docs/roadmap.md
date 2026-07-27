# Roadmap — the order to build the 28 in

Companion to `docs/idea-decisions.md`. That doc says **what** and **why**; this one
says **in what order** and **done means what**. It deliberately does not restate
rationale — items are referred to by their number there (`#11`), and bank §6 stages
by name (`S1`). If you want to know why something is on the list, read the other doc.

Two things were added that aren't in either doc, because sequencing surfaced them:
**F1–F3**, foundations that several accepted items silently depend on. They are not
new features. They are the parts of accepted features that have to exist first.

Status: **approved 2026-07-27.** Sprint 1 is built and green — see the results
note under it. Sprints 2–7 and Track B are unspecced and unbuilt. The open
question at the bottom (#4) is still Sidhant's call; Sprint 1 didn't depend on it.

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

---

### Sprint 4 — The JD flow, honest by construction
*Bank §6's critical path. S1 and #11's `requirementTable` are one piece of work seen from two ends — built together, per the decisions doc.*

**S1** `gaps` required with `noGapsRationale`; per-requirement `met`/`partial`/`unmet`/`unclear`; citation-or-downgrade (uses #21); extraction split from judgment · **#11** the generative-UI component vocabulary, `requirementTable` first · **S2** posting-as-hostile-input hardening

**Done means:** S0's soft-pedal and gap-naming assertions pass; the injection cases pass; `requirementTable` renders without implying arithmetic precision it doesn't have (the rendering constraint from decisions §3).

---

### Sprint 5 — Export and forward
*Everything here needs a conversation and a JD result worth exporting.*

**#17** one export surface — markdown, typeset print/PDF, permalink · **#18** URL-fragment permalink with the replayed-conversation banner · **#24** scorecard as an option inside #17 · **S3** folds in here rather than duplicating · **#13** extend the slash registry (`/budget`, `/sources`, `/pdf`) now that the targets exist · **#27** re-tenant the existing chrome as the persistent actions strip, with the post-action emphasis

**Done means:** `lib/transcript.ts` extended, not replaced; every export path tested against the 10-turn cap; the dependency added for PDF/docx named and justified per `CLAUDE.md`.

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
