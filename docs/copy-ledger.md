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
| draft | `components/shell/instruments.tsx` → cost meter | "Nothing you type is stored on the server. The conversation lives in this browser until you reset it, and the only thing kept server-side is a per-IP counter for the hourly limit." | none | `use-conversation.ts` (localStorage), `route.ts` (Upstash) |
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
| draft | `components/shell/app-shell.tsx` → actions strip | The five persistent action labels: "copy", "export", "link" (becomes "link copied"), "paste a job description", "reset". UI affordances rather than prose. | none | — |
| draft | `app/measurements/page.tsx` → page frame | Title "What this assistant scores", the metadata description, and the three opening paragraphs: what the page is ("Every instrument on this site measures one conversation — yours…"), how fresh it is ("…aggregated when the site is built, so they are exactly as old as the last deploy…"), and the honesty rule ("Where a figure is derived, drawn from a small sample, or not measured at all, it says so beside itself…"). | none | `scripts/build-measurements.mjs` — each sentence restates what that script does |
| draft | `app/measurements/page.tsx` → eval suite | The section intro describing the two eval layers, the live-runs intro, the two empty states ("No run has been published yet…", "No live run has been published yet."), and the two notes — that the static layer is assertions rather than questions asked of a model, and that a turn which failed in transport is counted separately from one the model answered badly. | none | `evals/README.md`, `evals/run-live.mjs` (the `BROKE` path from Sprint 1's finding 2) |
| draft | `app/measurements/page.tsx` → latency and reliability | The section intro, one sentence per reason the aggregate can be missing ("This build had no analytics credentials…" · "The analytics store answered and holds no chat turns in the window… this page cannot tell you which, so it will not guess." · "The analytics query failed while this site was being built…"), and the note that time to first token excludes the network to the browser. | none | `lib/chat-telemetry.ts` (the `ttftMs` doc comment), `scripts/build-measurements.mjs` |
| draft | `app/measurements/page.tsx` → groundedness | The section intro describing the checker, the narrowness paragraph ("Verified means the numbers and names in a sentence appear in the source it named. It does not mean the sentence is true…"), the calibration paragraph ("The checker is tuned to under-report… a checker that cries wolf stops being read."), the blind-spot paragraph ("…it has never been scored against a human-labelled sample of live answers"), the too-few line ("Under 20 published claims, so no rate is shown…"), and the job-description caveat ("…this is close to the least favourable sample the site could report, not a representative one."). | none | `lib/verify.ts`, the calibration block in `evals/citations.test.mjs`, and roadmap Sprint 3's finding 4 |
| draft | `app/measurements/page.tsx` | Figure labels and section headings — "The eval suite", "Live runs", "Latency and reliability", "Groundedness", "assertions", "claims verified", "too few to report", "not measured", "invented sources", "p50 first token", "prompt cache hit", "Failures by class". UI affordances rather than prose, logged as one row. | none | — |
| draft | `app/colophon/page.tsx` | "The assistant is tested against a fixed corpus, and what it scores is published rather than described. See the measurements." | none | `evals/published/latest.json` |
| draft | `components/shell/panel-body.tsx` → colophon | The second panel link label, "What it scores". | none | — |
| draft | `components/shell/app-shell.tsx` → mobile controls | Affordance labels added with the mobile pass: the "↓ PDF" chip beside the resume citation, and the "Send" / "Open navigation" screen-reader labels on the two icon buttons. UI affordances rather than prose, logged as one row. | none | `public/resume.pdf` |

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

## Pending `[VERIFY]` markers

Sentences drafted with a fact-shaped hole in them, waiting on Sidhant. Listing them
here means a `[VERIFY]` left in a file can't quietly ship.

| Where | What's needed |
| --- | --- |
| _(none)_ | |
