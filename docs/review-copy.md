# Copy review — everything waiting on Sidhant

Assembled 2026-07-27, after Sprints 5, 6 and 7 and Track B. This is the reading
list, not the ledger: `docs/copy-ledger.md` is the complete record of every
drafted string, and this document is the subset that actually needs a decision
from you, ordered so the expensive things come first.

Nothing here is blocking a deploy. All of it is live right now.

**How to work through it.** Parts 1 and 2 are the ones with consequences — a
wrong fact above the fold is the only thing on this list a hiring manager can
catch you out on. Parts 3 and 4 are judgment calls. Part 5 is the bulk read, and
it can be skimmed. Part 6 is a shopping list, not copy.

---

## Part 1 — Facts I could not source (3)

These are sentences that were written with a hole in them, per the copy rule:
never guess a plausible fact. Each one is marked `[VERIFY]` in the file and
listed in the ledger's pending table, so none of them can quietly ship as
though it were checked.

### 1.1 What A Darle 20 actually does, beyond what's written down
**File:** `content/adarle20-media.ts` → `FEATURE_SURFACE_NOTE`, renders on `/projects/adarle20`
**The sentence:** "This list is everything the written record names, which is not the same as everything the product does — [VERIFY: the features that exist in A Darle 20 but appear in no source file…]"

The feature list on that page is built strictly from `content/knowledge/`, and it
is visibly short. Specifically, **is there a reviews/ratings system, a search or
filter on listings, a host calendar or availability model, a cancellation policy
the product enforces, and is the site bilingual?**

Reviews and ratings are *visible in the screenshot already in this repo* and are
still not on the list, because a screenshot is not the record. Write one line per
capability into `content/knowledge/projects-adarle20.md` and they can be listed —
and the eval suite will then check the page against them.

This one is worth doing first: it's the item where the site currently
undersells the product, and the fix is a few lines in a markdown file.

### 1.2 What he is *not* looking for
**File:** `content/knowledge/faq.md` → "What is he not looking for?"
**Status:** pre-existing `[TODO]`, untouched.

More visible now than it was: the recruiter TL;DR and two of the four new chips
both point at what you *are* looking for, and the manual-mode fallback quotes the
FAQ verbatim — that entry is skipped there precisely because it still holds a
TODO. One sentence on roles or companies you'd decline closes it.

### 1.3 Is the repo public?
**File:** `docs/site-copy.md` → colophon, "[TODO: confirm repo is public before linking]"
**Needed:** yes or no.

Worth deciding now rather than later: Sprint 7 published the system prompt and
indexed the repo as a second corpus the assistant can quote from. The site
already talks about its own source in some detail.

---

## Part 2 — The six factual claims above the fold

**This is the highest-stakes copy on the site and the part I'd read twice.**

Every string Track A wrote was a claim about *the site*. These are claims about
*you*, on the homepage, above the fold, in a block labelled `tl;dr`. Each traces
to a corpus file and the eval suite verifies it against that file on every build.

| Label | Exact text | Traced to |
|---|---|---|
| now | "Sales operations specialist at Nokia, in Toronto. Co-founder and CTO of A Darle 20." | `bio.md` |
| shipped | "A Darle 20 — a two-sided marketplace, architected and shipped solo. 1,400+ registered users, 127 hosts and 2,100+ bookings in its first four months." | `resume.md` |
| before that | "At Nokia: a self-serve Power App used by 80+ stakeholders across seven regions, and a Salesforce Analytics to Power BI migration for 150+ users." | `projects-nokia.md` |
| how he builds | "An AI-agent-heavy workflow in Claude Code — agents write most of the code, he keeps architecture, code review and release." | `projects-adarle20.md` |
| looking for | "A RevOps / GTM systems role at an AI-forward company." | `faq.md` |
| where | "Toronto, ON. Canadian citizen, no visa sponsorship needed." | `faq.md` |

**The check that exists and the one that doesn't.** The suite proves the
homepage matches the corpus. It cannot prove the corpus is right. If `resume.md`
says 127 hosts and that number is four months stale, the homepage says it too
and every test stays green.

So the question to ask of each row is not "does this match my resume" — that's
automated — but **"is this still true, and is it the version I'd say out loud in
a first call?"** Particularly the numbers in *shipped* and *before that*, and
whether "architected and shipped solo" is how you want that said.

Also worth a look: **"agents write most of the code, he keeps architecture, code
review and release."** It's sourced and accurate, and it's an unusual thing to
lead with. It's your call whether it belongs in the top six.

---

## Part 3 — Strings where a rewrite changes what the site claims

These read like ordinary microcopy but each one is the visible half of something
the code actually does. Softening them would make the site assert more than it
can back up. Edit freely — but knowingly.

**The permalink caveat** — `components/shell/export-deck.tsx`
> "It is encoding, not encryption — anyone holding the link can read the conversation — and it is frozen at the moment you made it."

**The replay banner** — `components/shell/app-shell.tsx`
> "Replayed conversation. It was rebuilt from the link you opened — the site stored nothing, and this is a snapshot of what the model said then, not a live session."

"Snapshot", "the site stored nothing" and "not a live session" are each doing
separate work.

**What `verified` means** — `/measurements` and `components/shell/answer.tsx`
> "Verified means the numbers and names in a sentence appear in the source it named. It does not mean the sentence is true…"

The narrowest word on the site, deliberately. Upgrading it to a truth claim
would assert more than `lib/verify.ts` establishes.

**The three empty states on `/measurements`** — they say *different* things for
different reasons: no credentials, credentials but no data, query failed.
Collapsing them into one "no data" message would hide the difference between
"nobody has used it" and "the events aren't arriving."

**The refusal to publish a rate** — `/measurements`
> "Under 20 published claims, so no rate is shown — 3 of 6 is a pair of counts, not a percentage anyone should carry away."

**The refusal ledger's code-vs-prompt distinction** — `/refusals`
> "A refusal written into the prompt is a request… A refusal written into the code holds whether the model cooperates or not."

The whole page's value rests on not blurring those two.

**The unreadable-assessment line** — `components/shell/panel-body.tsx`
> "This assessment was saved by an older version of the site and can't be shown. Paste the posting again to rebuild it."

Blames the site, not the reader, and names the way out.

---

## Part 4 — Decisions, not corrections

### 4.1 The refusal ledger entry that speaks for you
**File:** `lib/refusals.ts`, entry 7, renders on `/refusals`. **This is the one entry on that page written in your voice rather than the code's, and it needs your eye more than anything else in Sprint 7.**

> **"Make a general case against hiring him"** — *a decision, not a mechanism.*
> Why: "It was proposed, and Sidhant turned it down: a blanket, role-free argument against the candidate, hosted by the candidate, is a liability with no upside. Honesty with no role to be honest about is self-sabotage with good manners."
> Instead: "The honest-fit value lives in the job-description flow, where a real posting is on the table and unmet requirements are named plainly against it."

It paraphrases your own reasoning from `docs/idea-decisions.md` §2. Check it's a
fair paraphrase and that you're happy having the rejected idea published at all.

The other ten entries describe code and prompt rules; they're on `/refusals` in
full and worth a skim, but they don't put words in your mouth.

### 4.2 The roast
Typing `/roast` sends this as the visitor's own turn:
> "Roast this site. Use the repo — name the specific choices, files and trade-offs that are actually weak, not the flattering kind of criticism."

The prompt constrains it to criticise the *site*, never you. It cites the
roadmap's own "what I didn't do" lists, so it will be uncomfortable in an
accurate way. **Read one and decide whether you like living with that.**

### 4.3 The four new homepage chips
Replacing "What did Sidhant build at Nokia?", "How does A Darle 20 work?",
"Is he a fit for a solutions engineering role?" with:

1. "Give me the 30-second version"
2. "What has he shipped end to end?"
3. "Is he a fit for a RevOps role at an AI-forward company?" — also what `/fit` sends
4. "Does he need visa sponsorship?"

Chip 4 is the one to think about. It's a real recruiter question and answering it
up front is genuinely useful — but you're choosing to raise it yourself.

### 4.4 Publishing the better groundedness number
`/measurements` currently reports **3 of 6 claims verified**, drawn entirely from
the job-description flow — the flow that cites least, by design. Sprint 7's live
run scored **11 of 12** on ordinary questions and was never published, because a
concurrent agent had overwritten the shared results file.

The page is honest about the sample being unfavourable, but it is showing close
to the worst number the site can produce. One command fixes it, run when nothing
else is using the repo:

```bash
npm run eval:live -- --group grounded && npm run eval:publish
```

### 4.5 A build-time analytics credential
`/measurements` can aggregate real latency and reliability if the build can read
`POSTHOG_PROJECT_ID` and `POSTHOG_PERSONAL_API_KEY` (server-side only, never
`NEXT_PUBLIC`). Unset today, and the page says plainly that it had no
credentials. Your call.

Related and worth knowing: **PostHog currently holds zero `chat_turn_complete`
and zero `chat_turn_failed` events.** Those emitters have existed since Sprint 1
and have never fired, so that panel has only ever been seen empty. `chat_message_sent`
does arrive, so the taxonomy isn't broken — but the latency panel has never
rendered a real number and won't until this is chased down.

---

## Part 5 — The full read, by surface

Skimmable. Everything below is logged in `docs/copy-ledger.md` with its source.

### `/measurements` (Sprint 6)
Title "What this assistant scores". Frame: "Every instrument on this site
measures one conversation — yours. This page is the aggregate…" · "All three are
aggregated when the site is built, so they are exactly as old as the last
deploy." · "Where a figure is derived, drawn from a small sample, or not measured
at all, it says so beside itself rather than in a footnote."

Sections: **The eval suite** (two-layer explanation, static vs live, the
transport-failure-vs-bad-answer distinction), **Latency and reliability** (TTFT
is server-side and excludes the network; percentile withholding thresholds),
**Groundedness** (what `verified` means, the under-report calibration, the
"reads numbers and proper nouns" limit, the never-scored-against-a-human caveat).

Labels: "assertions", "files", "run", "published", "claims verified", "answers
checked", "invented sources", "turns measured", "finished", "failed", "p50 first
token", "p95 first token", "prompt cache hit", "Failures by class", "too few to
report", "not measured".

### `/prompt` (Sprint 7)
Title "The instructions this assistant was given". Four paragraphs: the page
renders the same function the route calls so it can't fall behind; the knowledge
block is generated chunk by chunk and nothing is assembled per request (that's
what makes the cache hit); asking the assistant to recite the prompt still gets
declined *and why that isn't a contradiction*; the second corpus — 22 chunks
from 18 files, appended only when you ask about the site.

### `/refusals` (Sprint 7)
Title "What this assistant won't do". Frame: "Most of the interesting decisions
in a system like this are decisions about what it will not say…" · the
code-vs-prompt paragraph (Part 3) · "Nothing here is a new rule written for this
page. Each one already ran before it was listed."

Eleven entries, each *title / why / instead / enforcement*. Five "enforced by
code", five "asked of the model", one "a decision, not a mechanism" (§4.1).

### The export surface (Sprint 5)
Eight explanation strings in `export-deck.tsx` — empty state, markdown, print
("…gives a typeset document with working links — not a screenshot of this
page."), the link, the caveat, the over-length warning, the unsupported browser,
the scorecard, the mail draft. Plus labels: "Markdown", "Print", "Link",
"Scorecard", "copy the conversation", "download .md", "print / save as PDF",
"build a link", "copy the link", "open a mail draft".

### Manual mode — what a rate-limited visitor sees (Sprint 7)
Headline is **your existing** rate-limit line, unchanged. New below it:
"Nothing is broken and nothing is lost — the limit is per IP and refills on a
sliding hour… here is the same material it was reading, by hand: these are the
source files the answers are built from, quoted rather than summarized."
Sections "Straight answers, unassisted" and "The rest of the record". Footer:
"No model was called to render this, and it cost nothing. The resume is the
authoritative version either way."

### Project pages — "In plain terms" (Track B, #20)
A plain-language opener on each case study, before "The problem". Restatement
only — no numerals, asserted by test.

- **A Darle 20:** "Tabletop roleplaying games are played in groups, and somebody has to run the game for everyone else… The booking form is the easy part. The hard part is money…"
- **Nokia:** "A large company sells in a lot of places, and every quarter its executives need one picture of how that went… The fix isn't clever, it's just the whole job…"
- **Dell:** "A propensity model is a way of ranking that list… It was an internship… the pipeline figure below is an estimate built from average deal sizes rather than money anybody collected." ← **note this one volunteers its own caveat; check you're happy with that framing.**

### A Darle 20 feature surface (Track B, #19)
Heading "Everything in it". Intro: "The prose above is the story. This is the
surface area — what a host or a player can actually do." Groups: Discovery,
Booking, Payments, Communication, Accounts, Operations. See §1.1 — this list is
short on purpose and the fix is the corpus, not the page.

Media surface heading "What it looks like", with: "Frames with nothing in them
are waiting on a file. Each one says what it is for rather than showing a
stand-in, because a placeholder that looks like a product is a claim about a
product."

### Navigation and slash commands
Rail: "The instructions" (`/prompt`), "What it won't do" (`/refusals`).
Slash hints: "/prompt — Read the instructions it was given" · "/refusals — What
it won't do, and why" · "/site — How this site is built" · "/roast — Ask it
what's wrong with this site" · "/jd — Paste a job description" · "/budget —
Turns, tokens and what they cost" · "/sources — Every source the answers are
built from" · "/pdf — Export — markdown, print, link".

---

## Part 6 — Assets you need to record (#19)

Six empty slots on `/projects/adarle20`. Each shows a dashed frame with its
brief inside and the line "Nothing here yet". Drop a file in `public/images/`
and fill in one `asset: { src, alt, caption }` object in
`content/adarle20-media.ts`.

| Slot | Kind | Shape | What it must show |
|---|---|---|---|
| Booking a seat, end to end | screen recording | 16:9 | One unbroken take: listing → checkout → confirmation. Test account; no real player name or email on screen. |
| Paying in cash | screenshot | 9:16 | The OXXO path at the moment the player gets a payment reference for the convenience store. The part nobody outside Mexico has seen. |
| What a host sees | screenshot | 16:9 | A host's own view — profile, upcoming sessions, payouts. Test host account. |
| Host and player chat | screenshot | 9:16 | A real thread, long enough to read as a conversation and not a contact form. Redact or use test accounts. |
| The funnel, instrumented | screenshot | 16:9 | Whatever you actually watch to run the business. **Check this one before sending — it's the slot that would carry live numbers, and anything in it is published.** |
| The 251-player event | video | 16:9 | Footage or photographs from the convention. The largest thing the platform has run, and there is currently nothing on the site to show for it. A caption gets written from what you send, not before. |

**Already filled:** "Session listings" — the existing `public/images/adarle20-listings.png`.

Until they arrive the page shows the case study, the plain-language section, the
feature surface, and six labelled empty frames. No fake screenshot, no described
video, no stock stand-in.
