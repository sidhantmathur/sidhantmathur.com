# Idea decisions — what's in, from the idea bank

Filed 2026-07-27, two passes. Sidhant's read of `docs/idea-bank.md`, dictated in
voice mode and transcribed against the numbered entries; the second pass resolved
the Maybe list and set three project-wide policies (§4). **Still a shortlist, not a
plan** — nothing here has been sequenced, scoped, or costed. **Nothing is open**;
§3 records how the last three questions closed.

The bank stays as the archive. This doc is what survived.

Ideas that showed up in more than one advisor's list have been consolidated into a
single line with all the source references, since several "yes" calls were the same
idea heard twice.

---

## 1. In — the yes list

Grouped by what they'd actually become on the site, not by which model proposed them.

### Show the machinery

| # | Idea | Sources | Note |
| --- | --- | --- | --- |
| 1 | **Real cost meter** | Opus A8, Sonnet #15 | Emphatic yes, and it's the **single home for everything budget-related** — the "17/20" strip, dollars (input, cached input, output, session cumulative), and the privacy/trust framing all fold in here rather than living as separate surfaces. **The joke line is cut** on second pass: the numbers carry it, and there isn't obvious space. If it comes back, it's a hover or tap target on the meter, not permanent chrome. |
| 2 | **Published eval suite** | Opus A1 | Yes. Harness already exists in `evals/` from §6 Stage 0. |
| 3 | **Glass box — per-turn trace inspector** | Opus A3, Haiku #18 | Yes. Haiku's "explain your thinking" toggle is the same feature; build once. Framing he liked: *having the features of Claude or ChatGPT in this would be cool.* |
| 4 | **Retrieval flicker** | Fable #1 | Yes. |
| 5 | **Tokens-per-second seismograph** | Fable #2 | Yes. |
| 6 | **Failure theatre** | Opus A12 | Yes — force each error path so the degradation in `route.ts` is visible. |

### The site talking about itself

| # | Idea | Sources | Note |
| --- | --- | --- | --- |
| 7 | **"Read my instructions"** — publish the system prompt | Fable #6 | Yes. |
| 8 | **Interview the website** — index the repo as a second corpus | Fable #7 | Yes. |
| 9 | **"Roast this site"** | Fable #10 | Yes. Depends on #8 for grounding. |
| 10 | **Refusal ledger** | Fable #9 | Yes. Hand-curated, so it's content work — see the copy flag in §4. |

### Not a chat box in a rectangle

| # | Idea | Sources | Note |
| --- | --- | --- | --- |
| 11 | **Generative UI — answers as typed components** | Opus A10, Fable #11, Haiku #15, **Sonnet #12** | Yes, three-way convergence and Sidhant said yes each time it came up. Opus's framing is the one to build: **the model emits Zod-validated data, the site owns rendering.** The site is already doing this — `roleFit` in `app/api/chat/route.ts` is exactly the pattern, so this is extending a vocabulary, not introducing one. **The requirements checklist (Sonnet #12) is a component in this vocabulary, not a separate feature** — see below. |
| 12 | **Citations as marginalia** | Fable #12 | Yes. |
| 13 | **Slash commands** | Fable #15 | Yes — `/jd`, `/model`, `/budget`, `/sources`, `/pdf`. Called out as cool. |
| 14 | **Idle mode — the instrument hums** | Fable #5 | Yes. Zero API calls. Copy flag applies (§4). |
| 15 | **Manual mode — meet the cached me on rate limit** | Fable #19 | Yes, called a good idea explicitly. |
| 16 | **Teletype audio, off by default** | Fable #4 | Yes — "interesting idea, sure." Lowest stakes item on the list. |

### Export and share — consolidated

Sidhant's own consolidation, and the most useful structural note in the pass:

> *"Should we just have, like, export this chat and maybe a bunch of different
> options — download as markdown, download as docx, download as PDF, print, all
> that stuff. Maybe that's one way to simplify all these ideas."*

| # | Idea | Sources | Note |
| --- | --- | --- | --- |
| 17 | **One export surface for the conversation** | Fable #13, Fable #14, Sonnet #3, Sonnet #14, §6 Stage 3 | Yes as a **single control with options**, not five features. Markdown · PDF/print · permalink. The typeset print document (Fable #13) is the flagship rendering — Sidhant: *"it should be a button somewhere, maybe just add some visual interest."* |
| 18 | ↳ **URL-fragment permalink** | Fable #14, Sonnet #3 | **Yes, committed** — the conditional was resolved by measurement, see below. No storage, no dependency, no per-use cost. |

#### The permalink spike — measured 2026-07-27

The bank filed this as `M` with a caveat about multi-kB URLs getting mangled.
**Both are wrong for this site**, and the reason is the existing turn cap.

*No storage is involved.* The transcript is compressed into the URL **fragment**
(`#c=…`), and fragments are client-only by spec — they are never sent in the HTTP
request. The page loads as the same static file it already is, then JS reads the
hash and replays. Static-first survives; there is nothing to persist because the
URL is the storage. No Upstash key, no API call, no tokens.

*No dependency is needed.* `CompressionStream('deflate-raw')` is native in
browsers, so lz-string isn't required — which removes the only part of this that
would have needed a dependency conversation.

*Length is a non-issue here.* Deflate + base64url over realistic, non-repeating
transcripts:

| Turns | Raw JSON | Final URL | |
| --- | --- | --- | --- |
| 4 | 1,875 | **764** | safe everywhere |
| 8 | 3,752 | **1,235** | safe everywhere |
| 12 | 5,617 | **1,688** | safe everywhere |

`route.ts:53` caps conversations at **10 user turns**, with user messages capped at
500 characters. The 12-turn row therefore already exceeds the largest conversation
the site can produce — a permalink cannot realistically pass ~1,700 characters,
well under the ~2,000 mark where mail clients start breaking URLs. The bank's
mangling caveat applies to uncapped chats, not this one.

*Caveats that do survive:* the transcript is frozen at generation time (arguably
correct — it's a snapshot, not a live claim); base64 is encoding, not encryption,
so anyone holding the link reads the conversation; and a replayed URL must carry a
visible "replayed conversation — nothing was stored" banner so it is never mistaken
for a live session. Fable #14's joke — printing the byte count — still works.

### Off the chat surface

| # | Idea | Sources | Note |
| --- | --- | --- | --- |
| 19 | **Expand the Adarle 20 project page** | Haiku #22, reinterpreted | Yes, and reframed. Not a live AI walkthrough — make the existing project page genuinely rich: **screen recordings, video, screenshots, interactive bits, the full feature surface.** Sidhant: *"there's a shit ton of features buried up there."* This is the one item that is mostly not an AI feature. |
| 20 | **"Explain it like I'm five" as static prose** | Haiku #13, reinterpreted | Yes, on the project pages. **Written once at build time, not generated per visit** — Sidhant: *"that's probably more efficient than having them ask that every time."* So it's a layered explanation living in the page, not a chat feature. Drafted under the new copy policy (§4) and logged. |

### Promoted from Maybe on the second pass

| # | Idea | Sources | Note |
| --- | --- | --- | --- |
| 21 | **Verified claims — deterministic citation enforcement** | Opus A5 | Yes. Non-LLM post-pass checks the cited chunk actually contains the claim's numbers and proper nouns; failures render as unverified. The hard half of citations, and the deterministic backbone under #11 and #12. |
| 22 | **Groundedness self-report with calibration** | Opus A11 | Yes, conditional on feasibility. **Gate behind #2 (evals)** — the bank is right that without measurement this label is decoration that actively misleads. |
| 23 | **Latency and reliability panel** | Opus A14 | Yes. Sidhant's read: this one is easy. p50/p95 TTFT by model, error rate, cache hit rate, aggregated at build time from PostHog so the page stays static. |
| 24 | **Generate a scorecard** | Sonnet #1 | Yes — resolved as **another option inside the export surface (#17)**, not a standalone feature. Structured evaluation in interview-scorecard shape, exported like any other artifact. |
| 25 | **TL;DR for recruiters** | Sonnet #5 | Yes, conditional on ease. Build-time line above the fold so a chat-first site doesn't fail the 6-second scan. |
| 26 | **Recruiter-tuned question chips** | Sonnet #8 | Yes. Likely **replacing** the current chips rather than adding a recruiter/engineer toggle. |
| 27 | **Next-actions strip** (was: session-end nudge) | Sonnet #9 | Yes, **reframed from an interruption into a persistent affordance** — the trigger problem dissolves rather than getting solved. See below. |
| 28 | **The reverse interview** — the site screens the visitor | Fable #18 | Yes, **as an option** — something the visitor opts into, never the default path. Four or five questions about the role and team, then a brief on what maps and what doesn't, with a mailto that sends it to Sidhant with the answers embedded. The email is the database. |

#### The next-actions strip — why there's no trigger

Sonnet #9 was filed as a nudge fired at "session end." **That event doesn't exist
on this site.** Visitors close tabs; they don't finish. Every candidate trigger is
therefore a guess at an ending:

| Trigger | Verdict |
| --- | --- |
| Exit intent (cursor toward the tab bar) | Reliable-ish, but it is the newsletter-popup gesture. Wrong register for this site. |
| Budget threshold (3 of 10 turns left) | Clean signal, near-zero coverage — most visitors never approach the cap. |
| Idle after a completed answer (~45s) | Decent proxy for "done reading," also fires on anyone briefly distracted. |
| Model-decided, via a tool call | On-brand with `roleFit`, and the model has the context — but it will fire eagerly or never, and tuning it needs evals first. |
| Post-action (just copied an answer, opened a citation) | Highest-intent moment available, and no guessing at all. |

**The resolution is to stop building a nudge.** A nudge needs a trigger because it
interrupts. The actions only need announcing because they're hidden — so put export,
forward, permalink, and paste-a-JD in a **persistent strip**: quiet, mono, one line,
present from the first turn. The trigger problem collapses into *emphasis*: the
strip gains a little weight after a few answers, or right after someone copies
something. Nothing appears, nothing interrupts, nothing has to detect an ending.

This is the §4 instrumentation principle applied — ambient readouts around a simple
core, never modals in front of it. It also gives #17 and #24 a natural home.

---

## 2. Out — the no list

Recorded with the reason so they don't get re-proposed.

| Idea | Source | Reason |
| --- | --- | --- |
| Adversarial console ("try to break it") | Opus A2 | Skip. |
| Honest retrieval comparison | Opus A4 | No. |
| Reproducibility receipt | Opus A6 | No. |
| Bake-off — one question, N models | Opus A7 | No. |
| Second opinion (re-run on another model) | Fable #16 | No. Same idea as the bake-off; rejected in both places, which is a consistent signal. |
| **MCP server for the knowledge base** | Opus A9 | Hard no, despite being an advisor top-5. *"Why the fuck would they want my resume in their tooling?"* No audience. Closes open question §7.1 in the bank. |
| Documented API contract | Opus A13 | *"I don't know what A13 is doing for us."* No stated audience. |
| Generic agentic deep-answer mode | Opus A15 | No — matches Opus's own verdict. |
| Corpus gap surface | Opus A16 | No. |
| Confidence typography | Fable #3 | No. |
| **"The case against hiring me"** | Fable #8 | **Confirmed no on the second pass, and the reasoning is a project-wide principle — see §4.** Three advisors loved it for forwardability; Sidhant's objection outranks that: *"I don't want this to turn into a horror story like 'he was about to get this job, but his AI agent said he wasn't a good fit.'"* A blanket, role-free case against the candidate, hosted by the candidate, is a liability with no upside. The honest-fit value it was carrying survives in the JD flow's `gaps` field, where it's scoped to an actual role. |
| Gap / pattern pre-empt in the FAQ | Sonnet #6 | No, on second pass. |
| Ten questions (phone-screen game) | Fable #17 | Interesting, but no. |
| Printable one-page interview brief | Sonnet #4 | Skipped. The premise question it raised — *"isn't this just an alternative form of resume? Should there be twelve resumes by focus?"* — is a resume-strategy question, not a site feature, and doesn't need answering to close this out. |
| Keyword / ATS echo check | Sonnet #7 | *"Not worth anything."* |
| "Talk to my references" mode | Sonnet #10 | No — there aren't good references on the site to build it from. |
| Company-specific mode via URL param | Sonnet #11 | No. Not enough target companies nailed down, and it looks hard. |
| "Verify this" — inline provenance | Sonnet #13 | No. |
| Salary estimator, career pivot analyzer, skill obsolescence, imposter syndrome, skill decay, peer mirror, exit interview, cover letter, reference letter, learning paths, competing-resume chat, podcast script, jargon translator, take-home generator, code playground, reciprocal interviewer, mock interviews, whiteboard coach, interviewer feedback sim, career timeline, skill budget, resume radar, skill pairing, competitive profile analyzer | Haiku #1–#12, #14, #16, #17, #19–#21, #23–#30 | Not wanted. *"What do we... this is not helping."* Confirms the bank's own flag that a third of Haiku's list is **career coaching for the visitor**, a different product. Closes open question §7.5. |

---


## 3. Resolved during review — the three that needed working out

Nothing is open. All three items that survived the second pass were closed, and
each closed by being **reframed rather than voted on** — which is the pattern worth
noticing in this review.

| Idea | How it closed |
| --- | --- |
| Requirements as a checklist (Sonnet #12) | Not a standalone feature — a component in the generative-UI vocabulary (#11). Mockup: `docs/mockups/requirement-table.html`. |
| URL-fragment permalinks (Fable #14) | Not a storage question — measured, and it needs neither a database nor a dependency (#18). |
| Session-end nudge (Sonnet #9) | Not a trigger problem — a persistent strip instead of an interruption (#27). |

### The checklist — resolved, and it was mis-filed

Sidhant, on seeing the mockup:

> *"Doesn't this checklist make sense as part of the generative UI in the chat
> interface? Like if they upload a job description, this can be part of the result."*

**Correct, and it dissolves the question.** `roleFit` is already the generative-UI
pattern — a tool the model fills with validated data that the site renders. The
checklist isn't an alternative rendering to choose over prose; it's what Opus A10's
`requirementTable` component looks like, applied to the JD flow. A10 named that
component explicitly.

So Sonnet #12 is **not a standalone accept/reject**. It's folded into #11 as one
entry in the component vocabulary, alongside `timeline`, `metricTiles`,
`comparison`, and `architectureDiagram`. The build question becomes *which
components to build first*, and this one has the strongest case: the tool that
would emit it already exists, so it's a schema change plus a renderer rather than
new infrastructure.

**What that changes downstream:** bank §6 Stage 1 (per-requirement verdicts, `gaps`
required, deterministic citation-or-downgrade) and this component are the same
piece of work seen from two ends — Stage 1 is the schema, `requirementTable` is the
renderer. They should be built together, not sequenced.

What the checklist rendering actually changes, beyond appearance:

- **The soft-pedal loses its hiding place.** Today's optional `caveats` field
  produced *"that's a quick ramp"* about missing Looker/Tableau in the real Stage 0
  eval run — a gap named and dissolved in the same sentence. As a row tagged
  `unmet`, the prose can still soften it, but the tag has already been read.
- **`unclear` stops becoming a false `met`.** When a posting asks for something the
  corpus doesn't cover (people management, say), today it silently vanishes. The
  checklist has a slot for "can't answer this from the record."
- **It's the shape that makes citation enforcement (#21) visible** — a row that
  can't cite gets downgraded by code rather than by the model's judgment.
- **The cost:** a bigger schema, a longer generation, and a real risk that tags read
  as *measurements* — four crisp verdicts look more precise than the underlying
  assessment actually is.

That last point no longer argues for rejecting the feature; it's a **rendering
constraint on the component**. Whatever `requirementTable` ends up looking like has
to avoid implying arithmetic precision it doesn't have.

---

## 4. Project-wide policies set during this review

Four calls that reach past the idea list. **Three are changes to standing rules and
have been applied.**

### Copy — the never-write rule is replaced by a ledger

`CLAUDE.md` previously said never write, edit, or improve copy. Sidhant lifted it:

> *"It's better to have your guesses there filling up the content so that I can see
> what the site looks like. But obviously we want to track everything — I don't want
> AI misrepresenting my experience somewhere, I just need to be able to review all
> the content."*

**Applied.** `CLAUDE.md` now allows drafting placeholder copy under two conditions:
every drafted string is logged in `docs/copy-ledger.md`, and **no fact about
Sidhant is ever invented** — employers, dates, titles, metrics, tools, and outcomes
must trace to `content/knowledge/` or the resume, or be marked `[VERIFY]` rather
than guessed. Voice and tone are drafted; claims about his experience are not.

This unblocks four shipped-item dependencies that were stuck behind it: refusal
ledger (#10), idle-mode one-liners (#14), manual-mode static FAQ (#15), and the
explain-like-I'm-five prose (#20). It closes bank open question §7.3.

### Dependencies — allowed when they earn it

> *"We can add dependencies for legitimately useful things like a PDF/docx export
> tool that we wouldn't want to roll ourselves."*

**Applied.** `CLAUDE.md`'s blanket no-new-deps rule is now scoped: libraries are
fine when hand-rolling would be worse, with the addition and reasoning stated. New
*services* still need asking. This unblocks the export surface (#17, #24) and the
client-side PDF/docx parsing in bank §6 Stage 4. Closes bank open question §7.2.

### Instrumentation density — go dense, keep the core simple

Bank open question §7.4 asked how much of the "show the machinery" family to build,
worrying that together it's a lot of instrument and not much conversation. Sidhant
resolved it in favour of density, with a specific reference:

> *"I like having lots of instrumentation, it gives the site a very technical feel…
> it fits with the monospace and dark mode. Think of those Chinese 'world monitor'
> dashboards — super info dense and probably too much, but it looks cool. We can
> have lots of instrumentation, but the core is still simple: just a chatbot."*

**The design constraint that follows:** density is a legitimate aesthetic here, but
it lives *around* the conversation, never in front of it. A visitor who ignores
every readout should still have a working chatbot. Instruments are ambient — they
don't add steps, modes, or decisions to the main path. That's the line to hold
when #1–#6 and #21–#23 all want screen space.

### Honesty and advocacy — where each belongs

Prompted by the "case against hiring me" rejection, and worth stating once because
it governs prompt work across the site:

> *"Everyone's agent is sycophantic, and I generally like Anthropic models in that
> they're less so — but still, you're working for me on this site, no? Try to sell
> me. But obviously I don't make sense as a Staff Engineer at Meta."*

The resolution: **advocate by default, be honest when a specific role is on the
table.** In open chat the site makes the best true case for Sidhant. In the JD
flow — where a real posting has been pasted and a real mismatch would surface in an
interview anyway — it names unmet requirements plainly, which is what bank §6 Stage
1 already builds toward. What's ruled out is the unprompted, role-free case against
him: honesty with no role to be honest *about* is just self-sabotage with good
manners.

Note this does **not** soften the grounding rules. Selling him means making the
strongest case the evidence supports, not padding it — the citation enforcement
(#21) and eval suite (#2) exist precisely so advocacy stays checkable.

---

## 5. For whoever plans these — what this review already established

Findings from the repo that shaped decisions above, recorded so they aren't
rediscovered. Verify before relying on any of them; they were true on 2026-07-27.

- **The generative-UI pattern already exists.** `roleFit` in
  `app/api/chat/route.ts` (~line 229) is a Zod-validated tool whose output the
  client renders. #11 extends that vocabulary rather than introducing it.
- **`caveats` is optional** in that same schema, described as "omit if there is
  nothing honest to say" — the bank's §6 diagnosis. Note bank §6's Stage 0 results
  found the *predicted* sycophancy failure didn't occur; a different one did (the
  model drops the tool entirely on poor-fit postings). Read that before touching it.
- **Conversations cap at 10 user turns**, user messages at 500 chars
  (`route.ts:53`). This is what makes #18's permalink small enough to work.
- **Transcript serialization exists** — `lib/transcript.ts`, dependency-free,
  unit-tested by `evals/transcript.test.mjs`. #17 should extend it, not replace it.
  Its header comment asserts no site copy lives there; the copy rule has since
  changed (§4), but that file's constraint is still worth keeping.
- **An eval harness exists** — `evals/`, with `npm run eval` (free, static) and
  `npm run eval:live`. #2 publishes what this already produces.
- **`CompressionStream('deflate-raw')` is native** — #18 needs no dependency.
- **Design tokens are canonical and must not be re-derived** — `app/globals.css`,
  which carries a specific warning about never redeclaring `--accent`.

## 6. Open threads not touched by this review

- **The JD expansion (bank §6)** was not reviewed in either pass and stays banked
  as-is, but two of its stages now have homes here: Stage 3's export work merges
  into #17 rather than duplicating it, and Stage 1 is the schema half of the
  `requirementTable` component in #11.
- **Sequencing — ~~the one thing left to do~~ done, see `docs/roadmap.md`.**
  Nothing in §1 had been ordered, scoped, or costed. Twenty-eight items is a
  roadmap, not a sprint, and several have hard dependencies: #22 needs #2, #9 needs
  #8, #24 needs #17, and #11's `requirementTable` needs bank §6 Stage 1's schema.
  That conversation happened on 2026-07-27. `docs/roadmap.md` holds the order —
  seven sequential sprints plus a parallel copy-gated track — and adds three
  foundations (F1–F3) that accepted items turned out to depend on. It also records
  the resolution of #4, which could not be built as filed: **there is no retrieval
  on this site**, so it ships as a post-hoc "sources touched" readout instead.
  This doc stays the why; the roadmap is the order.
