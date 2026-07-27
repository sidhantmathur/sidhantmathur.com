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
| draft | `components/shell/instruments.tsx` | Instrument labels and section titles — "Cost", "Rate", "Trace", "Failure theatre", "Sound", "session cost", "saved by the cache", "what came over the wire", etc. UI affordances rather than prose, logged as one row. | none | — |

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
