# Sprint 4 spec — the JD flow, honest by construction

One page, written 2026-07-27 at the point of starting the sprint, per
`docs/roadmap.md` → "How the work gets specced". Intent and acceptance only; it
names no files or functions, because those move.

Covers **S1** (bank §6 Stage 1), **#11** (`requirementTable`, the first entry in
the generative-UI vocabulary), and **S2** (bank §6 Stage 2).

---

## Intent

A pasted posting is the one turn on this site with a decision attached to it.
Today it produces a role name, a handful of areas the model chose to talk about,
and an optional sentence of caveats. Three things follow from that shape, and
all three are structural rather than bad luck:

- **Coverage is incidental.** Nothing connects the requirements in the posting
  to the things the assessment talks about, so a requirement can go unanswered
  without anything noticing. Sprints 1 and 3 both ended with the same failing
  assertion for this reason — an honest assessment that simply skipped a line.
- **`unclear` has nowhere to go.** When a posting asks for something the record
  doesn't cover, the only available moves are to claim it or to drop it.
- **The assessment doesn't stand on the record.** `evidence` is free text with
  no anchor, so Sprint 3's checker — which is deterministic and already running
  on every other sentence the site produces — cannot see it.

This sprint replaces the shape. Requirements are **extracted before they are
judged**, every extracted requirement **gets a row**, every row carries a
**verdict and a citation**, and a row that claims something and cites nothing is
**downgraded by code**. The posting itself is treated as what it is: untrusted
text pasted by a stranger.

## What ships

**S1 — honesty as structure.** The assessment is a list of requirements with
`met` / `partial` / `unmet` / `unclear` per row. Extraction is a separate step
from judgment, so the list of requirements is fixed before anything has an
opinion about them, and coverage of that list is checked by code rather than
hoped for. Gaps are required output, not an optional field; an assessment with
no gaps has to say why in its own words. A row asserting a fit and citing
nothing valid is downgraded to `unclear` — by the same deterministic checker
Sprint 3 built, not by the model's judgment.

**#11 — `requirementTable`.** The renderer for that schema, and the first named
component in the generative-UI vocabulary: verdict per row, the evidence under
it, the cited chunk openable beside it, the downgrades marked where they
happened, and counts a reader can take in at a glance.

**S2 — the posting as hostile input.** The posting is delimited explicitly and
marked as data, the untrusted-input rules are re-asserted *after* it because
recency matters, a cheap deterministic pre-pass flags instruction-shaped
language aimed at an assistant, and the output path stays constrained — a
compromised generation can still only fill a validated schema.

## Constraints

1. **The prompt stays byte-identical across requests** (Sprint 3, constraint 1).
   Anything added per-turn goes in the user message, never in the system prompt.
2. **A broken turn is worse than a mediocre one.** Sprint 1's finding: a turn
   that dies mid-stream reads exactly like the bug it was chasing. Schema
   strictness that can reject a real generation is a failure path, so the
   invariants this sprint promises are enforced in code after the model answers,
   not by validation that can throw the turn away.
3. **The rendering must not imply arithmetic it doesn't have** (decisions §3).
   Four crisp tags look more precise than the assessment underneath them. No
   score, no percentage, no weighting — counts are counts.
4. **A citation can only be required of a positive claim.** An absence cannot
   cite anything: `unmet` and `unclear` rows are the honest output, and
   demanding a source for them would push the model toward claiming instead.
5. **Leniency runs one way** (Sprint 3, note 3). The checker reports absence,
   and a mark on a correct row teaches the reader to ignore all of them.
6. **The ambient rule holds** (decisions §4). Pasting a posting is one action and
   stays one action; nothing here adds a step for the visitor.
7. **Copy rules** (CLAUDE.md): every drafted string logged, no invented facts.
   Requirements shown on screen are the posting's words — the input, not a claim
   about Sidhant.

## Done means

- S0's gap-naming assertions pass: every requirement the posting states gets a
  row, including the ones the model would have skipped.
- The soft-pedal assertion passes — a dissolved gap is still a tagged row.
- The injection cases pass, including a posting that ends in an instruction to
  rate the candidate as a perfect match.
- `requirementTable` renders counts without implying precision it doesn't have.
- A row that claims a fit and cites nothing valid is downgraded **by code**, and
  that path has a static eval case.
- `npm run build`, `npm run lint`, and `npm run eval` are clean.

## Out of scope, deliberately

- **Export, scorecard, mailto, permalink** — bank §6 Stage 3 folds into #17,
  which is Sprint 5. The transcript keeps working; it does not get redesigned.
- **File upload and URL fetch** — bank §6 Stage 4. Nothing new crosses the wire
  this sprint.
- **Derived artifacts and comparison mode** — Stages 5 and 6, upside.
- **Publishing per-model pass rates** — Stage 7 is #2, in Sprint 6.
- **Prose citation behaviour.** The closing sentence after the tool call still
  cites like any other sentence, and Sprint 3 owns that path unchanged.
