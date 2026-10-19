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
renders correctly from a live server.

**The mono nit is closed too (2026-08-18).** The OG image asked for
`monospace`, but satori ignores CSS font stacks and fell back to its default
sans. The Geist Mono 400/500 TTFs are vendored in `assets/fonts/` (byte-identical
to the `geist` package) and passed to `ImageResponse`; `/opengraph-image`
prerenders at build time, so the read costs nothing at request time. Verified by
reading the generated PNG, not by inspecting the source. Original brief kept
below for the palette references.

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

**Done — `700459b` refreshed the allowlist.** Sonnet is gone, and the two
open questions below it resolved along the way. Original brief kept at the
bottom for the reasoning.

The routing is real and working — `app/api/chat/route.ts` has an allowlist,
per-tier rate-limit buckets, and returns the remaining budget in response
headers, which the status strip renders.

What shipped, on the resolution of each point:

- **Sonnet is dropped.** The premium tier did *not* go with it — it was
  re-tenanted rather than turned off. `openai/gpt-5.6-luna` ($1.00/$6.00 per
  1M) holds the slot at 5/hour. The reasoning is in the commit message: this
  workload is input-dominated (~4k tokens of system prompt and knowledge base
  against ~300 tokens of answer), so input price is what bills, and Sonnet at
  $3/1M input was not worth 3x Luna here.
- **The tier machinery stays**, as this note argued it should — and since
  premium still has a tenant, the two-tier budget strip is still doing its
  original job rather than surviving as vestigial structure.
- **More cheap models were added to `standard`**: it is now haiku-4.5,
  gpt-5-mini, gemini-3.5-flash-lite, and deepseek-v4-flash. Gateway list
  prices are noted inline in `MODELS` as checked 2026-07-27.

**The drift risk this note left open is closed too.** There is no client list
to keep in step any more: `lib/models.ts` is the one catalogue, and the route,
the dropdown, `lib/pricing.ts` and `scripts/run-bakeoff.mjs` all read it. The
regex in `evals/lib/artifacts.mjs` that scraped `MODELS` out of two files to
compare them is gone with the copies it existed to police; the static suite
now asserts things about the catalogue's content instead. Adding or removing a
model is one edit in one file.

**Update 2026-08-12 — the premium slot re-tenanted a second time.** Luna's
short-context price is now published at $0.20/$1.20 per 1M, which makes it a
cheap model, so it moved to `standard` as a workhorse alongside the new
default, `deepseek/deepseek-v4-flash-0731` (the Gateway id for the snapshot
that replaced deepseek-v4-flash upstream). Haiku 4.5 — now the most expensive
input price in the catalogue at $1/1M on an input-dominated workload — holds
the premium slot's 5/hour bucket instead. Same reasoning as when Sonnet left:
the tier is a cost boundary, and it holds whichever model bills most per turn.

**Update 2026-10-19 — successors in, four decisions open.** Haiku 4.5 became
`anthropic/claude-haiku-5.5` and gpt-5.6-luna became `openai/gpt-6-luna`, both
$0.10/$0.50. DeepSeek 0731 was repriced to $0.076/$0.153. Every cache rate is
now the Gateway's published figure, and two of the derived ones had been well
off. The per-row record is in the header of `lib/models.ts`. The smoke test
that followed is below the list. What needs Sidhant:

1. **The premium tier no longer separates anything.** Applied as written, the
   rule now puts `gemini-3.5-flash-lite` in premium. At $0.30/$2.50 it is the
   priciest row, but only 1.2x gpt-5-mini; Haiku 4.5's input price was more
   than 3x the next row's. A 5/hour bucket on a model that costs what the
   20/hour ones cost shows no cost engineering at all. The options:
   - **Turn the tier off** (recommended): every model goes standard. That
     touches `lib/models.ts`, the "exactly one model is premium" test in
     `evals/static.test.mjs`, the allowance paragraph in `lib/system-prompt.ts`
     (published at `/prompt`), and the dropdown comment in `app-shell.tsx`.
   - **Re-tenant it** with a model that is actually expensive, such as
     `anthropic/claude-sonnet-5.5` at $2/$10, about 20x the standard rows per
     token. That is a new model to choose and to measure.
   - **Leave it**, with gemini on 5/hour.
2. **The default model's price is unconfirmed per turn.** The Gateway serves
   deepseek-v4-flash-0731 through fifteen providers, at $0.02–$0.44 input and
   $0.15–$1.32 output. The catalogue carries the headline rate, which is the
   cheapest provider's. The route pins no provider, so the meter for most
   visitors' turns can read several times low. There are two fixes, both route
   changes: pin a provider (`providerOptions.gateway.order` or `only`), or price
   turns from the Gateway's own per-request cost in the response metadata
   instead of estimating at list price. *In the smoke test the risk did not
   show:* all ten DeepSeek turns went to runware, the headline-price provider,
   and on every one of the 35 turns the Gateway's reported cost matched the
   meter's list-price estimate exactly. Nothing guarantees that routing,
   though, which is why the label stays.
3. **deepseek-v4.1-flash is the newer version.** DeepSeek's own endpoint on
   the Gateway serves it rather than 0731. It was not swapped in for two
   reasons: its first-party rate doubles in weekday peak windows (01:00–04:00
   and 06:00–10:00 UTC), which a list-price meter cannot express, and the swap
   would change the default model.
4. **Haiku 5.5 thinks by default; 4.5 did not.** Thinking bills against
   `MAX_OUTPUT_TOKENS`, which is 600 on an ordinary turn. The smoke test
   confirmed it: with default thinking, the RevOps chip spent 599 of 600 tokens
   thinking and rendered nothing. With thinking off, that chip still failed: a
   one-line preamble plus the `roleFit` call came to more than 600 tokens, and
   the call was cut off. Haiku needs thinking off *and* more room on
   tool-calling turns.

**Decided 2026-10-19** (Sidhant's approval, relayed by the site-review
session): `openai/gpt-6-luna` is the default and the premium tier is gone,
which was item 1's first option. Every model now spends from one 20/hour
bucket. Items 2–4 stay open. Still only a recommendation: drop gpt-5-mini or
give it a reasoning setting. It blanked on two of four chips, and it was the
slowest and costliest model on the posting.

The bake-off should be re-run once 1–4 are settled. Three of the five models
on offer have never been measured. At current list prices, with July's token
counts, it should cost roughly $0.20–$0.50 in total.

### Smoke test, 2026-10-19 — the data for choosing a default

The council reviews found that the default, deepseek-v4-flash-0731, returns
blank answers. This test reproduces that and measures every model in the
catalogue on the same five turns: the four homepage chips
(`SUGGESTED_QUESTIONS` in `content/recruiter.ts`) and one GTM-systems job
posting of about 2,500 characters, sent with the JD form's prefix. DeepSeek
and Haiku 5.5 also ran with reasoning switched off.

**Method.** One turn per cell, each in a fresh conversation. The server was
`next dev` on this branch, with only `AI_GATEWAY_API_KEY` set, so the route
used its in-memory limiter. Reasoning was switched off with AI SDK 7's
top-level `reasoning: 'none'` option, which the Gateway translates per
provider. Both models then reported 0 reasoning tokens. It was passed through
a temporary local hook in the route that was never committed. Times are
measured at the client: "first visible" is the first text or tool card,
"total" is the end of the stream. Cost is the list price from `lib/models.ts`,
and the Gateway's own reported cost was identical on every turn. In total:
35 turns, $0.070.

**Summary.**

| Model | Reasoning | Rendered | Chips: first visible | JD: card at / done | $ per chip turn (warm cache) | $ JD |
| --- | --- | --- | --- | --- | --- | --- |
| deepseek-v4-flash-0731 | default | **3/5**: RevOps chip and JD blank | 1.5–3.2 s | never / 43 s | 0.0001–0.0003 | 0.0008 |
| deepseek-v4-flash-0731 | none | 4/5: JD card all unclear, raw markup in the answer | 0.8–5.6 s | 4.5 / 18 s | 0.0001–0.0009 | 0.0009 |
| **gpt-6-luna** | default | **5/5** | 0.9–4.6 s | 25 / 32 s | 0.0001–0.0006 | 0.0026 |
| claude-haiku-5.5 | default | **2/5** clean: RevOps chip blank, "shipped" truncated, JD card duplicated | 1.1–2.6 s | 12 / 22 s | 0.0002–0.0004 | 0.0049 |
| claude-haiku-5.5 | none | 4/5: RevOps chip has no card | 0.7–1.2 s | 11 / 16 s | 0.0001–0.0004 | 0.0040 |
| gpt-5-mini | default | **2/5** clean: two chips blank, JD has no card | 1.7–4.1 s | 31 / 72 s | 0.0005–0.0013 | 0.0198 |
| gemini-3.5-flash-lite | default | 5/5, but the JD covered 6 of 14 requirements | 0.7–3.2 s | 3.9 / 4.9 s | 0.0021–0.0056 | 0.0090 |

The first turn for each model ran with a cold cache and cost several times a
warm one; it is left out of the "warm" column. Gemini's cache almost never
hit, so every Gemini turn is effectively cold.

**Recommendation: make `openai/gpt-6-luna` the default, unchanged.** It is the
only model that rendered all five turns with no configuration change. Its
chips finished in 1–7 s for under a tenth of a cent each. On the posting it
produced a 14-row card that names the gaps (3 met, 8 partial, 3 unmet), and it
was the cheapest JD turn to produce a usable card. Its weakness is
JD latency: 25 s before the card appears, with 1,397 reasoning tokens. Trying
`reasoning: 'low'` on JD turns is the obvious next experiment (untested).

How the others rank:

- **Haiku 5.5 with thinking off** produced a complete JD card (5 met,
  6 partial, 2 unmet, 1 unclear) in 16 s, the fastest complete card in the
  test. It loses only the RevOps chip, and only to the 600-token cap. If the non-JD cap rose to about 1,000, it is the
  likely second choice (untested).
- **DeepSeek with reasoning off** fixes the chips, but on the posting its
  `roleFit` call came back empty (14/14 unclear). It then wrote its retry into
  the visible answer as 6,200 characters of raw `<｜DSML｜tool_calls>` markup.
  Not usable for JD turns.
- **Gemini** is the fastest and never blank, but it extracted 6 of the
  posting's 14 requirements and needed two `roleFit` attempts on the RevOps
  chip. With no cache hits, it costs 3 to 20 times Luna per turn, though still
  under a cent.
- **gpt-5-mini** should be fixed or dropped. It blanked on two chips, and the
  JD took 72 s and $0.02 and still produced no card.
- **DeepSeek at default reasoning should not stay the default.** It blanked
  on 2 of 5 turns. Both blanks spent the entire cap on reasoning
  (600/600 and 4,000/4,000).

**The premium tier should not survive.** No turn in the test cost two cents.
The model the literal rule makes premium, Gemini, is the fastest one that
never blanked, so the 5/hour bucket currently rations the snappiest model
rather than the expensive one. Option (a) above, turning the tier off, is what
the data supports.

**What the data says about the route** (Sidhant's call, none of it in
committed code):

- **Choose reasoning per model.** A `reasoning` field on each catalogue row,
  passed to `streamText`, would stop a reasoning-heavy model spending the
  whole cap. The top-level option works through the Gateway: `'none'` took
  DeepSeek and Haiku to 0 reasoning tokens.
- **The 600-token cap is per step.** A `roleFit` call alone took 360–450
  tokens on the models that completed one, so a model that writes a sentence
  before the call runs out.
- **Show a turn that ends empty as a failure.** Five of the 35 turns ended
  with no text and no card, behind a green dot. That is the council's
  point, now measured.

**Every turn:**

| Model | Reasoning | Prompt | What rendered | finishReason | First visible (s) | Total (s) | In / cached | Out (reasoning) | $ list |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| deepseek-v4-flash-0731 | default | 30-second | text | stop | 1.8 | 2.8 | 7,196 / 0 | 274 (80) | 0.00059 |
| deepseek-v4-flash-0731 | default | shipped | text + `showProject` card | stop | 3.2 | 6.8 | 14,837 / 14,592 | 518 (278) | 0.00030 |
| deepseek-v4-flash-0731 | default | RevOps fit | **nothing**: all 600 tokens spent reasoning | length | — | 6.5 | 7,204 / 7,168 | 600 (600) | 0.00019 |
| deepseek-v4-flash-0731 | default | visa | text | stop | 1.5 | 1.5 | 7,195 / 7,168 | 67 (37) | 0.00011 |
| deepseek-v4-flash-0731 | default | JD | **nothing**: all 4,000 tokens spent reasoning | length | — | 43.2 | 7,787 / 7,168 | 4,000 (4000) | 0.00076 |
| deepseek-v4-flash-0731 | none | 30-second | text + `showResume` card | stop | 1.0 | 6.4 | 14,534 / 7,168 | 308 (0) | 0.00071 |
| deepseek-v4-flash-0731 | none | shipped | text + `showProject` card | stop | 0.8 | 4.2 | 14,603 / 14,080 | 260 (0) | 0.00028 |
| deepseek-v4-flash-0731 | none | RevOps fit | text + `roleFit` card | stop | 5.6 | 9.7 | 15,425 / 6,912 | 863 (0) | 0.00088 |
| deepseek-v4-flash-0731 | none | visa | text | stop | 0.9 | 0.9 | 7,116 / 6,912 | 29 (0) | 0.00012 |
| deepseek-v4-flash-0731 | none | JD | card with 14/14 unclear, then 6.2k chars of raw `DSML` tool-call markup as the answer | stop | 4.5 | 18.4 | 23,743 / 19,712 | 1,807 (0) | 0.00086 |
| gpt-6-luna | default | 30-second | text | stop | 1.5 | 2.6 | 6,267 / 0 | 139 (23) | 0.00085 |
| gpt-6-luna | default | shipped | text | stop | 2.0 | 2.8 | 6,268 / 6,253 | 204 (122) | 0.00017 |
| gpt-6-luna | default | RevOps fit | text + `roleFit` card | stop | 4.6 | 7.0 | 13,568 / 12,525 | 601 (61) | 0.00056 |
| gpt-6-luna | default | visa | text | stop | 0.9 | 1.2 | 6,266 / 6,253 | 42 (9) | 0.00009 |
| gpt-6-luna | default | JD | card (3 met, 8 partial, 3 unmet) | stop | 25.0 | 32.1 | 25,932 / 20,437 | 3,361 (1397) | 0.00256 |
| claude-haiku-5.5 | default | 30-second | text | stop | 2.1 | 2.8 | 10,375 / 0 | 440 (208) | 0.00151 |
| claude-haiku-5.5 | default | shipped | text cut off mid-answer | length | 2.6 | 3.2 | 10,376 / 10,290 | 600 (449) | 0.00041 |
| claude-haiku-5.5 | default | RevOps fit | **nothing**: 599 of 600 tokens spent thinking | length | — | 3.7 | 10,388 / 10,290 | 600 (599) | 0.00041 |
| claude-haiku-5.5 | default | visa | text | stop | 1.1 | 1.2 | 10,378 / 10,290 | 92 (43) | 0.00016 |
| claude-haiku-5.5 | default | JD | good card, then a second card with 14/14 unclear | stop | 12.0 | 22.1 | 48,948 / 30,870 | 5,458 (1594) | 0.00485 |
| claude-haiku-5.5 | none | 30-second | text | stop | 1.0 | 2.1 | 10,374 / 0 | 311 (0) | 0.00145 |
| claude-haiku-5.5 | none | shipped | text | stop | 0.7 | 2.0 | 10,375 / 10,289 | 354 (0) | 0.00029 |
| claude-haiku-5.5 | none | RevOps fit | a one-line preamble, then the `roleFit` call cut off by the cap; no card | length | 0.9 | 3.6 | 10,387 / 10,289 | 600 (0) | 0.00041 |
| claude-haiku-5.5 | none | visa | text | stop | 1.2 | 1.4 | 10,377 / 10,289 | 59 (0) | 0.00014 |
| claude-haiku-5.5 | none | JD | card (5 met, 6 partial, 2 unmet, 1 unclear); answer opens with commentary on its own retry | stop | 10.8 | 15.5 | 47,770 / 30,867 | 4,076 (0) | 0.00404 |
| gpt-5-mini | default | 30-second | text | stop | 4.1 | 5.4 | 6,267 / 0 | 584 (384) | 0.00273 |
| gpt-5-mini | default | shipped | **nothing**: 576 of 576 tokens spent reasoning | length | — | 5.5 | 6,268 / 6,144 | 576 (576) | 0.00134 |
| gpt-5-mini | default | RevOps fit | **nothing**: 576 of 576 tokens spent reasoning | length | — | 5.8 | 6,275 / 6,144 | 576 (576) | 0.00134 |
| gpt-5-mini | default | visa | text | stop | 1.7 | 2.0 | 6,266 / 6,144 | 149 (64) | 0.00048 |
| gpt-5-mini | default | JD | no card (`roleFit` produced no output); 6.1k chars of prose instead | stop | 31.3 | 72.4 | 32,696 / 22,144 | 8,284 (5184) | 0.01976 |
| gemini-3.5-flash-lite | default | 30-second | text | stop | 0.7 | 1.2 | 6,694 / 0 | 197 (0) | 0.00250 |
| gemini-3.5-flash-lite | default | shipped | text | stop | 0.9 | 1.7 | 6,693 / 0 | 262 (0) | 0.00266 |
| gemini-3.5-flash-lite | default | RevOps fit | called `roleFit` twice before a card rendered | stop | 3.2 | 4.2 | 22,206 / 11,472 | 797 (0) | 0.00556 |
| gemini-3.5-flash-lite | default | visa | text | stop | 0.9 | 1.1 | 6,691 / 0 | 25 (0) | 0.00207 |
| gemini-3.5-flash-lite | default | JD | card, but only 6 of the posting's 14 requirements extracted | stop | 3.9 | 4.9 | 21,769 / 0 | 970 (0) | 0.00896 |

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

## 5. Two defects found during the deepening pass — tracked as issues

Filed 2026-08-11 from branch `deepen-chat-transport`. Both are on GitHub now;
this section is the index, the detail is in the issues.

- **[#2](https://github.com/sidhantmathur/sidhantmathur.com/issues/2) — the
  ranked-bar charts say "not measured" for a median that was measured but
  withheld.** `components/charts/ranked-bars.tsx:41`. Haiku's newest run is 6
  turns, under `MIN_TURNS_FOR_P50`, so the median is withheld — the chart says
  the opposite. Already wrong on two panels; `dc1ed0a` spread it to four by
  applying the same gate to token medians. `lib/measurements.ts:33` already
  models the distinction (`"too-few" | "not-measured"`); `rank()` collapses it.
  Needs a copy decision, so it wants Sidhant, not an agent.
- **[#3](https://github.com/sidhantmathur/sidhantmathur.com/issues/3) — the stop
  button disappears the moment an answer starts rendering.** `phaseOf` returns
  null once the assistant message has text (`use-conversation.ts:135`) and the
  control lives inside `{phase && …}` (`app-shell.tsx:966`), so it only exists
  between 8s elapsed and the first token — a window that never opens on a
  healthy turn. Pre-existing (`b820054`, `c930843`), not from this branch. The
  abort path itself is sound and now covered by `evals/chat-transport.test.mjs`;
  it is the affordance that is unreachable.

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
