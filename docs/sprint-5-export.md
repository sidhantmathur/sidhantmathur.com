# Sprint 5 spec — export and forward

One page, written 2026-07-27 at the point of starting the sprint, per
`docs/roadmap.md` → "How the work gets specced". Intent and acceptance only; it
names no files or functions, because those move.

Covers **#17** (one export surface), **#18** (URL-fragment permalink), **#24**
(scorecard as an option inside #17), **S3** (bank §6 Stage 3, folded in rather
than duplicated), **#13** (extend the slash registry) and **#27** (the
persistent actions strip).

---

## Intent

Four sprints have built something worth taking away, and there is still exactly
one way out of the page: a clipboard button that emits markdown. The
job-description assessment — the one output on this site with a decision
attached to it — leaves as a bulleted list. Nothing can be re-opened later,
nothing can be attached to an email, and nothing can be sent to a colleague as
a link.

This sprint gives the conversation **one door with several handles**. Not five
features: a single control with options, which is Sidhant's own consolidation of
five ideas in the decisions doc. The handles are the ones a recruiter actually
uses — text they can paste, a document they can attach, a link they can forward
— plus the scorecard shape for the case where the assessment is the artifact
rather than the conversation.

Two things it must not become. It must not become a storage feature: the site
persists nothing server-side and the export surface is not where that changes.
And it must not become a step: a visitor who never opens it still has a working
chatbot, per the standing instrumentation policy.

## What ships

**#17 — the export surface.** One place that offers the same conversation in
the shapes it can honestly take: markdown to the clipboard, a markdown file, a
typeset document for print or save-as-PDF, and a link. The typeset document is
the flagship rendering — a real document, not a screenshot of a chat.

**#18 — the permalink.** The conversation is compressed into the URL *fragment*,
which never reaches a server. Opening one replays the conversation with a
banner that says so, so it can never be mistaken for a live session. The
measured caveats in the decisions doc travel with it: the snapshot is frozen at
generation time, and the encoding is encoding, not encryption.

**#24 — the scorecard.** When the conversation contains an assessment, the
export surface offers it in interview-scorecard shape as well: headline verdict,
the counts, the strongest cited rows, **every** gap, and the recommendation line
the model wrote. Nothing in it is composed by the export code.

**S3 — forwarding.** A prefilled mail draft carrying the condensed scorecard,
sized to the ceiling mail clients actually accept.

**#13 — the slash registry.** `/budget`, `/sources` and `/pdf` now have targets
to point at, and `/jd` already did.

**#27 — the actions strip.** The controls the shell already has — copy, reset —
stop being two links wedged into the input row and become a persistent one-line
strip that also carries export, link, and paste-a-JD. It is present from the
start and it never interrupts; the trigger problem is answered with *emphasis*
after an action rather than with a nudge.

## Constraints

1. **`lib/transcript.ts` is extended, not replaced.** It is pure,
   dependency-free and unit-tested directly under `node --test`; every shape
   this sprint adds is another pure function in that lane, testable without a
   browser or a build.
2. **No storage, no new server route.** The fragment is the transport, and the
   page it loads is the same static file it already was.
3. **Every export path is tested against the 10-turn cap.** The turn cap is what
   makes the permalink viable, and the largest conversation the site can produce
   is the one every path has to survive — including one carrying a pasted
   posting and a full assessment.
4. **Length is reported, not assumed.** The permalink's size is measured and
   shown. If a conversation produces a link past the size mail clients handle,
   the surface says so rather than emitting a link that will be cut in half.
5. **A dependency for the document is allowed but must be earned** (CLAUDE.md).
   If none is added, say why, because "we didn't add one" is also a decision
   that needs stating.
6. **The exported artifact does not upgrade its own claims.** Sprint 3's marks
   and Sprint 4's downgrades mean something narrow; whatever leaves the page
   carries the same narrowness or leaves the information out.
7. **The ambient rule holds** (decisions §4). Nothing here adds a step, a mode,
   or a decision to asking a question.
8. **Copy rules** (CLAUDE.md): every drafted string logged, no invented facts.

## Done means

- One surface offers markdown, a file, a printable document, and a link, and the
  scorecard when there is an assessment to make one from.
- A permalink round-trips a 10-turn conversation including a job-description
  assessment, and opening one shows the replayed-conversation banner.
- Replaying a permalink does not overwrite the conversation already in the
  reader's browser.
- The slash registry's new commands each open something that exists.
- The actions strip is present from the first turn, on desktop and on a phone,
  and gains emphasis after an action rather than interrupting.
- `npm run build`, `npm run lint`, and `npm run eval` are clean, with new static
  cases for the encoder, the scorecard, and the 10-turn cap.

## Out of scope, deliberately

- **File upload and URL fetch** — bank §6 Stage 4. Nothing new crosses the wire
  this sprint, and the JD flow's input stays a paste.
- **Derived artifacts** — questions from `unclear` rows, ramp plans, cover notes
  (Stage 5). The cover-note draft in particular needs Sidhant's explicit
  blessing before any agent writes one.
- **Comparison mode** (Stage 6) and **published pass rates** (Stage 7 / #2,
  Sprint 6).
- **`.docx` export.** Markdown pastes into every tool a recruiter uses and the
  print document covers the attachment case; a third binary format is a
  dependency with no reader.
- **A short link, a server-side store, or any analytics on what a link
  contains.** The fragment never leaves the browser and that is the feature.
- **`/model` as a slash command.** It needs an argument parser, which the
  registry does not have; the header select still works.
- **The reverse interview (#28)** and the recruiter copy in Track B.
