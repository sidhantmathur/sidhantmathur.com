# Gauntlet log

A builder/critic loop over the whole site, started 2026-10-22 while Sidhant
slept. Method: https://somethingbig.ai/gauntlet-loop — a goal, an inspectable
bar, the work split into pieces that can be judged alone, a builder and a
separate fresh critic per piece, looping until the critic's biggest remaining
gap is small.

This file is the live progress page. Newest round at the bottom.

## Goal

Make the site irresistible to a hiring manager screening for **revenue
operations** or **delivery operations** roles at an AI-forward company, without
breaking any standing rule (`CLAUDE.md`, `docs/idea-decisions.md` §4).

Target roles changed tonight: Sidhant said "rev ops or delivery ops type role".
That is his statement, so `content/knowledge/faq.md` now carries it.

## The bar

Two halves, both inspectable.

**Design** — the best personal sites as measured tonight (rauno.me, paco.me,
emilkowal.ski, leerob.com, brianlovin.com, brittanychiang.com, jakub.kr,
nat.org). What they share:

1. A who/what sentence in the first two lines.
2. Calm hero type: 36–42px at most, `text-wrap: balance`.
3. One column, 600–700px, body 15–17px at ~1.6.
4. Two faces, two weights; hierarchy from grey steps, size and spacing, not boxes.
5. One accent colour.
6. Items as a linked title plus one line of outcome; depth on the detail page.
7. Metrics with scope: baseline, timeframe, owner. One number, one source,
   reconciled everywhere.
8. One primary action, one secondary.

No excellent personal site from a RevOps or delivery-ops person was found. An
engineering-quality typographic site with ops-grade evidence is open ground.

**Hiring signal** — from ~85 live RevOps / GTM systems / delivery ops postings
at Anthropic, OpenAI, Ramp, Notion, Harvey, Sierra, Decagon, Vercel and others:

- Outcomes in operating terms: time saved, process eliminated, adoption.
- Builds the thing himself ("build the model, process, or dashboard themselves").
- Owns it "from discovery through enablement and adoption".
- AI fluency with receipts ("point to concrete things you've shipped this way").
- Advisor, not order-taker; ambiguity turned into a mechanism other teams use.
- Delivery ops vocabulary: capacity, headcount, forecasting, operating cadence,
  activation, launch. The bridge in his record is the workforce management role
  (headcount reporting and forecasting for 3,000–4,000 people).
- "Power BI" appears in almost none of these postings; "data model", "SQL",
  "sales reporting" and "forecasting" appear everywhere. Lead with the work, not
  the Microsoft tool name.

Gaps a recruiter will notice, which copy must not paper over: no Salesforce admin
build work, no CPQ or deal desk, no PSA, SOW or billable-utilization experience.
The site advocates; it does not imply depth he hasn't claimed.

## Rules for every builder

- No new facts. Every claim traces to `content/knowledge/` or the resume.
- Every drafted string goes in `docs/copy-ledger.md` under "Gauntlet pass,
  2026-10-22".
- Sentence case, no all-caps, no tactical language, radius 0.
- `npm run build`, `npm run lint` and `npm run eval` green before a commit.
- Look at it: `CHROMIUM_PATH=/opt/pw-browsers/chromium npm run shot`.

## Rounds

### Round 0 — baseline critique

A blind critic (Fable) read the live site as a RevOps / delivery ops hiring
manager. The five-second read: "a guy named Sidhant in Toronto, something about
revenue ops, wants a job." Missed: employer, what he ran, any number. Top gaps:
the H1 was a motto, not a fact; the role line was small type beside the photo;
five actions competed in the hero; the summary sat on glyph noise; inner pages
said the same fact four times; inner H1s were mono at 40px and read as terminal
output.

### Round 1 — wave 1 builders

Five lanes in parallel, each in its own worktree, merged and fact-checked by the
lead before any critic saw them.

| Lane | What changed |
| --- | --- |
| Front door (lead) | H1 now names the job: "I build and roll out the systems sales and finance teams run on." Role line is title, employer, city. Subline names both role families. One row of actions. First-person summary with a new "before that" row for the workforce role (the delivery-ops evidence). Chips ask what a screener asks. Reading column of the backdrop near-solid. |
| Nokia and Dell | Outcome strip (80+ · one workday · 150+). Four repeating sections became "What changed" plus a five-stage "How I ran it". The workforce role got its own section. Dell is short and honest. |
| A Darle 20 | Opens with "At a glance". The money flow, the pricing test and running on funnel numbers each get a section. Lead cut two overclaims ("quote to cash"; a sentence implying the audit workflow predated launch). |
| Typography and index | Inner-page titles and section heads in Geist Sans. /projects intro and cards lead with outcomes. Resume screenshot no longer cropped. |
| Metadata and chat | Title, description, llms.txt and share card name both role families. The system prompt gains "Making his case", mapping his record to delivery ops and naming the gaps only when a posting asks. |

All green: build, lint, 497 static tests, marker check.

### Round 1 critique — Fable, blind, plus an independent fact audit

Scores: home 7, home mobile 7, Nokia 7, share card 7, /projects 6, resume 6,
A Darle 20 5, Dell 4. Top gaps: delivery ops invisible above the fold; A Darle
20 twice as long as it earns; chat dock eating 18% of a laptop viewport; resume
summary contradicts the homepage and blends two roles; Dell apologises for its
own number.

The fact audit checked ~115 rendered claims: every number and date held; scope
didn't. "The systems" for one app and one migration, "teams run on" for tools
he built, the funnel credited with the pricing decision, "first four months"
when building began before launch, a page title implying a delivery-ops job.
All fixed the same hour.

### Round 2 — wave 2 builders

| Lane | What changed |
| --- | --- |
| Front door (lead) | The workforce row (headcount forecasting for 3,000–4,000 people, $1.2M identified) now reaches the first viewport at 1280×800: full-width summary, two trimmed rows, a shorter dock, no duplicate "Toronto, ON" in the header, no line ending on "AI-". |
| /projects and footer (lead) | The 2018 internship is a quiet link, not a third peer. The AI claim is concrete. Doc pages name both role families in the contact line. |
| Nokia and Dell | Nokia strip gains "3,000–4,000" as a 2×2; "Headcount and forecasting, 2022–2024" sits right after "What changed"; the unbacked LLM/Python line is cut. Dell's caveat is one clause. |
| A Darle 20 | 28% shorter. The feature grid (decided item #19) is one line per area below the screenshot; pricing test and stack are one sentence each. |
| Resume drafts | `docs/resume/drafts/`: one-page RevOps and delivery ops resumes (.md, .docx, .pdf) built from one source so formats can't drift, plus a paste-ready fix for the canonical summary's blended numbers. Not deployed; for Sidhant to send. |

Checks: build, lint, 497 static tests, marker check, a11y audit (0 problems),
pre-hydration load check (13/13).
