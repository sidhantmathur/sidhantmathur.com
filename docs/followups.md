# Followups — next agent, start here

Filed 2026-07-27 by Sidhant at the end of the instrument redesign
(phases 1–6, branch `redesign/instrument`, merged to `main`).

Read `docs/implementation-plan/00-decisions.md` §2 first — it is the design
system and it records *why* several non-obvious things are the way they are.
Do not undo those without reading the reasoning.

---

## 1. Favicon

**Done — `f33d629` redrew the favicon, apple icon, and OG image on the
instrument palette.** Verified 2026-07-31: all three render dark
(`#111010`/`#0B0A09` grounds, `#E4522B` accent), and `/opengraph-image`
renders correctly from a live server. One nit remains: the OG image asks for
`monospace` but satori loads no monospace font, so it renders its default
sans instead of Geist Mono — filed as its own task. Original brief kept below
for the palette references.

The site has `app/icon.svg` from the light-system era; it has not
been looked at since the redesign and is very likely still the old paper/ink
mark on a light ground, which will look wrong in a dark browser tab.

- Check `app/icon.svg` and `app/opengraph-image.tsx` — the OG image is almost
  certainly still light-themed too, and that's what renders when the link is
  pasted into Slack or LinkedIn. That matters more than the favicon for a job
  hunt.
- Design tokens are in `app/globals.css`. The accent is `#E4522B`.
- Keep it legible at 16px. Radius 0 is the house style but a favicon is not
  obliged to follow it.

## 2. Model selection

The routing is real and working — `app/api/chat/route.ts` has an allowlist,
per-tier rate-limit buckets, and returns the remaining budget in response
headers, which the status strip renders. What needs revisiting is *which*
models are in it.

- **Sidhant leans toward dropping Sonnet entirely.** It is currently the only
  `premium`-tier entry (`anthropic/claude-sonnet-4.5`, 5/hour). Deleting that
  one line in `MODELS` turns the whole tier off; nothing else needs to change.
  It is a public endpoint and that model is substantially more expensive than
  the others.
- If the premium tier goes, decide whether the tier *machinery* stays. The
  visible `standard 17/20` budget in the status strip is a deliberate design
  point — showing the cost engineering rather than hiding it — and it still
  works with a single tier. Keep it.
- Worth adding more cheap models to `standard` for variety. The client list is
  `MODELS` in `components/shell/app-shell.tsx` and must stay a subset of the
  server allowlist. An id that isn't on the server list silently falls back to
  the default rather than erroring, so a mismatch is invisible — check both.

## 3. Copy — Sidhant is doing this, do not write it

Two blocks on the live site are Claude's drafts, marked `[DRAFT]` in
`docs/site-copy.md`. Sidhant is rewriting them in his own voice.

- **"Why this site is a chatbot"** — rail item, opens in the panel. Text lives
  in `WHY_CHATBOT` in `components/shell/shell-data.ts`, following the
  `site-copy.md` section of the same name.
- **"Job-description fit"** — the `JD_COPY` object in the same file.

The hero was chosen by Sidhant and is final:

> I learn what the problem needs, then I build the thing.
> Ask what you'd ask on a call.

Both lines are load-bearing. `site-copy.md` explains why; don't drop the
subline to "tighten" it.

`CLAUDE.md` says never to write or edit site copy. Sidhant granted a one-time
exception during the redesign, which is how these drafts exist. **That
exception has expired** — treat the rule as fully in force again unless he says
otherwise. `docs/hero-options.md` has the full list of 49 hero candidates from
four advisors if any of it is useful as raw material.

## 4. Job-description fit — brainstorm and expand

Sidhant likes this one and wants to develop it further. Current state is
deliberately minimal: a rail item opens a textarea in the panel, the posting is
sent as an ordinary chat turn, and the system prompt tells the model to treat
it as a `roleFit` request and put unmet requirements in `caveats`.

What exists: `JobDescriptionForm` in `components/shell/panel-body.tsx`,
`submitJd` in `components/shell/app-shell.tsx`, the `roleFit` tool in
`app/api/chat/route.ts`, and the roleFit guidance in `lib/system-prompt.ts`.
The user-turn cap was raised 500 → 4000 chars for this flow.

A four-model brainstorm (Haiku, Sonnet, Opus, Fable) has since run; the full
output is in `docs/idea-bank.md`. §6 is a staged roadmap for this feature.

**Stage 0 is done — the feature has now been tested against real postings**
(`npm run eval:live -- --group roleFit`, harness in `evals/`). The result was
not what was predicted. Gap-naming is *good*: on a posting he's unqualified for
the model volunteers "no management experience, no track record hiring … falling
short of the 8+ year requirement." The actual bug is structural — **on the
postings he's least qualified for, the model stops calling the `roleFit` tool
and answers in prose**, so there is no structured assessment and `caveats` is
empty because the whole object is missing. Every downstream idea in §6 reads
from that object. Full write-up in `docs/idea-bank.md` §6.

Directions worth exploring — **brainstorm with Sidhant before building**:

- Structured output rather than prose: requirement-by-requirement match, with
  each row citing the chunk that backs it. Sprint 3 built the half this needs:
  `lib/chunks.generated.ts` addresses the whole corpus and `lib/verify.ts`
  checks a citation deterministically. The schema half is Sprint 4.
- A shareable result. A recruiter forwarding a fit assessment to a hiring
  manager is the highest-value thing this feature could do, and there is
  currently no way to do it. Note this needs storage, which the architecture
  deliberately does not have — that's a real decision, not a small feature.
- Honest-gap emphasis. The instruction to name unmet requirements is the whole
  point of the feature and it is currently one sentence in the prompt. It has
  not been tested against a real posting. **Test it against several before
  building anything else here** — if the model soft-pedals gaps, that is the
  bug to fix, and no amount of UI helps.
- URL/file input for a posting instead of paste. Weigh against the static-first
  architecture: fetching a URL server-side is a new outbound request surface.

---

## Known-open, not on Sidhant's list

- **Resume images.** `/resume` has exactly one screenshot
  (`public/images/adarle20-listings.png`), captioned to explain that the Nokia
  work is internal tooling behind a corporate login and can't be shown. If
  Sidhant supplies more A Darle 20 assets (convention event, booking flow, host
  dashboard) the layout already has a `<figure>` pattern to follow.
- **Playwright MCP is now configured.** Use it. Three defects in this redesign
  — sheets rendering in the wrong font, a dead band on `/resume`, a slab of
  accent orange where a bordered button belonged — passed both build and lint
  and were only caught by screenshotting. Look at what you change.
- **`--accent` collision.** Never declare an `--accent:` role for shadcn; its
  generated theme wants that name for a hover background and the later
  declaration silently wins. It cost this redesign a stretch of rendering in
  pale cream instead of red. See §2.1 of the decisions doc.
- **`docs/implementation-plan/00-decisions.md` §3 and §4** still describe the
  retired light document-style site and are marked superseded. They should be
  rewritten to describe the instrument system rather than left as archaeology.
