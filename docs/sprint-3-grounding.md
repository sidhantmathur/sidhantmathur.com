# Sprint 3 spec — grounding

One page, written 2026-07-27 at the point of starting the sprint, per
`docs/roadmap.md` → "How the work gets specced". Intent and acceptance only; it
names no files or functions, because those move.

Covers **F2**, **#21**, **#12**, and **#4** as resolved in the roadmap.

---

## Intent

Today an answer's evidence is implicit. The whole knowledge base goes into the
prompt as one opaque string, the citation index only covers `resume.md`, and the
model never names a source — so "which line of the record is this sentence
standing on?" is a question the site cannot answer about its own output.

This sprint makes the corpus **addressable**, makes the model **name what it
used**, and then **checks the naming with code rather than trusting it**. That
last part is the sprint: an unchecked citation is decoration, and a site whose
argument is that its instruments are honest cannot afford a decorative one.

## What ships

**F2 — addressable corpus.** Every file in `content/knowledge/` is chunked into
units with stable, human-readable ids. The ids are visible to the model inside
the knowledge base itself, so the vocabulary and the text it names can never
drift apart. The model is instructed to attach ids to fact-bearing sentences.

**#21 — verified claims.** A deterministic, non-LLM post-pass reads each
fact-bearing sentence, extracts its numbers and proper nouns, and checks them
against the text of the chunks that sentence cited. A sentence that cites a
chunk not containing its facts, cites an id that doesn't exist, or cites nothing
at all is **downgraded by code**. No model judges this, and no model can talk its
way out of it.

**#12 — citations as marginalia.** The ids leave the prose and become a margin,
next to the paragraph they belong to. A downgraded sentence is marked there too.

**#4 — sources touched.** After an answer lands, the chunks it actually cited
light up under it, openable in the context panel. Post-hoc by construction: this
is the "settle" the roadmap resolved it into, not a retrieval flicker.

## Constraints

1. **The prompt stays byte-identical across requests.** The cache hit that makes
   every turn cheap is not negotiable, and #1 would render the damage if it
   broke. Chunking is a build-time transformation, not a per-turn selection.
   There is still no retrieval.
2. **Nothing implies a search happened.** No animation, no "searching…", no
   ordering that suggests the ids were looked up before the answer. They were
   not.
3. **The ambient rule holds** (decisions §4). A visitor who ignores the margin
   still has a working chatbot; nothing here adds a step, a mode, or a decision
   to asking a question.
4. **The verifier is deterministic and free.** No model call, no network, no
   dependency. It has to be testable offline or it cannot be trusted.
5. **An honest verifier says "I didn't check that."** It reports what it
   actually checked — numbers and proper nouns — and never presents absence of a
   flag as proof that a sentence is true. `verified` means *the numbers and names
   in this sentence appear in the chunk it cited*, and the UI must not overstate
   it beyond that.
6. **Copy rules** (CLAUDE.md): every drafted string logged, no invented facts.

## Done means

- A claim without a valid chunk id is downgraded **by code**, not by the model's
  judgment.
- The downgrade path has an eval case — including a claim that cites a real
  chunk which does not contain its number, which is the case that separates
  "checked" from "looks checked".
- The citation index covers the whole corpus, not just the resume, and every id
  it publishes appears in the knowledge base the model reads.
- `npm run build`, `npm run lint`, and `npm run eval` are clean.

## Out of scope, deliberately

- **Retrieval.** Rejected in the roadmap, for the reason in constraint 1.
- **`roleFit` citation-or-downgrade.** The tool's schema gains no `sources`
  field this sprint. That is Sprint 4's `requirementTable` work, which the
  decisions doc says is one piece of work with bank §6 Stage 1 and must be built
  with it. This sprint gives that sprint the verifier to call.
- **Publishing verification rates.** Aggregate groundedness numbers are #22,
  gated on #2 (Sprint 6). Per-answer marks only.
- **The export surface.** Copied transcripts should not leak raw markers, and
  that is fixed here — but rendering sources properly in an exported artifact is
  #17, in Sprint 5.
