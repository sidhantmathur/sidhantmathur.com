# Sprint 7 spec — the site talking about itself

One page, written 2026-07-27 at the point of starting the sprint, per
`docs/roadmap.md` → "How the work gets specced". Intent and acceptance only.

Covers **#7** (publish the system prompt), **#8** (index the repo as a second
corpus), **#9** (roast this site, needs #8), **#10** (refusal ledger) and
**#15** (manual mode — meet the cached me on rate limit).

This closes Track A.

---

## Intent

Six sprints have built a site that argues its instruments are honest, and every
one of those instruments points at Sidhant. Nothing points at the site. A reader
who wants to know *what this thing actually is* — what it was told, what it
won't do, what's wrong with it — has to take the site's word for it, which is
exactly the position the rest of the build refuses to put anyone in.

So: publish the instructions, make the repo a corpus the assistant can be held
to in the same way it is held to the resume, let it criticise its own code, say
plainly what it refuses to do, and give the visitor who runs out of turns
something better than an apology.

The failure mode to name up front is different from Sprint 6's. **This is the
sprint most able to turn the site into a novelty.** A roast button in the
message column, a chatbot that mostly talks about itself, an instrument that is
funnier than it is true — each would trade the site's one asset for a joke.
Decisions §4 already settles it: this all lives around the conversation, never
in front of it, and a visitor who never asks about the site never sees any of it.

## What ships

**#7 — the system prompt, published.** A pre-rendered page that renders the
actual assembled prompt, from the function the route calls, not a copy of it.
The assistant still declines to recite it in chat, and the page says why that
isn't a contradiction.

**#8 — the repo as a second corpus.** The site's own source, chunked and
addressable under `repo:` ids, cited and checked by exactly the machinery
Sprint 3 built for the knowledge base. It is **extracted, never written**: every
line comes verbatim out of a file that already exists in this repo, so the
second corpus needs no new prose and can be checked against the tree.

**#9 — roast.** Not a mode and not a persona. A question the site knows how to
ask well, grounded in #8, aimed at the code and the choices. It criticises the
site; it never criticises Sidhant, and it invents nothing.

**#10 — the refusal ledger.** A hand-curated page: what the assistant will not
do, why, and what happens instead. Every entry names the file that enforces it.

**#15 — manual mode.** A rate-limited visitor currently gets one grey sentence.
Instead they get the corpus itself — the same material the model was reading,
by hand, with no model and no tokens.

## Constraints

1. **The prompt cache is the budget.** The knowledge base is concatenated
   byte-identically into every system prompt so the provider's cache hits, and
   Sprint 2's meter would show the damage if it stopped. The second corpus must
   leave an ordinary turn's system prompt **byte-for-byte what it is today**.
   That is a testable claim and it gets a test, and the cost of a turn that does
   load the second corpus is measured and written down here, not estimated.
2. **A second corpus is a corpus, not a special case.** `repo:` ids are cited
   in prose like any other id, opened in the panel like any other id, and
   checked by `lib/verify.ts` like any other id. A repo claim that cites nothing
   is downgraded exactly as a résumé claim is.
3. **Scope widens by exactly one topic.** The site itself becomes a legitimate
   subject. Everything else the prompt declines today, it still declines —
   including coding help, other people, and general knowledge about LLMs.
4. **The roast is aimed at the site.** Decisions §2 rules out the role-free case
   against Sidhant, and a roast that drifts onto him is that idea wearing a
   costume. It is also not licence to invent a flaw: a criticism cites a
   `repo:` id or it is prose the checker will mark.
5. **Nothing new gets in front of the conversation** (decisions §4). No new
   modal, no new mode, no new step on the main path. The surfaces are the ones
   that already exist: the rail, the slash registry, the context panel, and
   pre-rendered pages.
6. **Static-first.** `/api/chat` stays the only server route. Both new pages are
   pre-rendered, and the repo corpus is built at build time like the knowledge
   base.
7. **Manual mode invents nothing.** The cached answers are the corpus, verbatim.
   Writing "what Sidhant would say" for a visitor who ran out of turns would be
   the exact failure the copy rule exists to prevent.
8. **Copy rules** (CLAUDE.md): every drafted string logged in
   `docs/copy-ledger.md`, no invented fact about Sidhant, `[VERIFY]` rather than
   a plausible guess. The refusal ledger is the largest piece of hand-written
   copy in the sprint and every entry has to be true of the code as it is.

## Done means

- The published prompt page renders the string the route actually sends, both
  halves of it, and a test fails if the page ever renders a copy instead.
- An ordinary turn's system prompt is byte-identical to what it was before this
  sprint, asserted by a test, and the size of the second corpus is written down
  in the results with the measurement it came from.
- The assistant answers a question about the site's own construction with
  `repo:` citations that open in the panel, and a claim it can't support is
  marked by the same checker that marks a claim about Nokia.
- Asking it to roast the site produces criticism specific enough to be actioned,
  cites the repo, and says nothing about Sidhant.
- The refusal ledger lists every refusal the code actually enforces, each with
  the file that enforces it, and a test fails if a listed anchor stops existing.
- A rate-limited visitor sees usable material rather than an error, reproducible
  on demand through the failure-theatre path rather than by waiting for traffic.
- `npm run build`, `npm run lint` and `npm run eval` clean, with the suite larger
  than the 180 it starts at and no existing assertion loosened.
- A live run, because this sprint changes the system prompt: the refusal and
  injection groups have to still pass, and prompt extraction in particular has
  to keep failing now that the prompt is public.

## Out of scope, deliberately

- **Real retrieval over the repo.** No embeddings, no vector store, no per-turn
  selection. #4's resolution stands: retrieval breaks the byte-identical prompt
  and the meter would show it.
- **The whole source tree.** A corpus is a curated set of chunks a claim can be
  checked against, not a code dump. Minified bundles and generated files are not
  evidence about anything.
- **A roast mode, a roast persona, or a roast page.** One question, asked well.
- **Refusals as a runtime feature.** The ledger is content: it describes rules
  that already exist. Nothing in this sprint adds a new refusal.
- **Writing answers for manual mode.** No generated FAQ, no cached model output.
- **Track B** — project pages, recruiter copy, #19, #20, #25, #26.
