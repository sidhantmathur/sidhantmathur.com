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

## Part 0 — The copy pass (2026-10-20): what's yours to decide

You asked for a pass on copy that "sounds super AI". Eleven lanes reworded the
site, each checked by a reviewer; no fact about you changed. Every new string,
with its old wording, is in `docs/copy-ledger.md` → "Copy pass, 2026-10-20".
These are the calls the pass left for you. A second pass the same day took out
copy that was too "cute" (ledger → "Cute pass, 2026-10-20"); its items are in
their own group below, and the items here are updated to match it.

**Start with these four.**

1. **The refusal entry that speaks for you** (`lib/refusals.ts` → `case-against`,
   on `/refusals`; §4.1 below has the new text). It paraphrases your decision, and
   the label now reads "decided by Sidhant" instead of "a decision, not a
   mechanism". If you'd rather not be named in a label, "not built" works.
2. **The lines in your voice that Claude wrote.** The two case-study closings, now
   under a "Summary" heading (`content/nokia.mdx`, `content/adarle20.mdx`, and their
   third-person copies in `content/knowledge/`), the Dell closing ("The internship
   is where I first got interested in work that combines data, revenue and
   tooling…", `content/dell-ml.mdx`), and "If you're going through candidates and
   can't call me, you can ask the assistant…" (`WHY_CHATBOT`,
   `components/shell/shell-data.ts`). Check each one sounds like you.
3. **The colophon credit line** (`app/colophon/page.tsx`) now reads "Most of the code
   was written by AI agents working from a build spec. I made the decisions." The
   copy pass took "copy" out of it, because nearly all the copy is still Claude's
   draft, and the cute pass took out "so the mistakes are mine". Add "copy" back
   once you've rewritten it, or say outright that AI drafted much of it.
4. **The A Darle 20 money section is short now** (`content/adarle20.mdx` → "The
   unit economics"). It would be much stronger with what the commission-versus-
   ticket-sales test decided and any take-rate, GMV or revenue figure you'd
   publish. None of that is in the record.

### (a) Facts only you can supply

- **"Including the commission question above"** (`content/adarle20.mdx`, funnel
  section) keeps the old claim that funnel data fed the commission decision. Cut it
  if that isn't how it went. The same section's "how many players visit, register
  and book" is inferred from "conversion"; confirm you track those stages.
- **"how he builds"** row in the summary block (`content/recruiter.ts`): sourced from A Darle 20 but
  read as how you build in general. Does it hold for Nokia too?
- **Nokia card, "I model and maintain it"** (`content/projects.ts`): the record says
  you owned the data modeling. Confirm "maintain" is still current.
- **"The numbers above are ones I can stand behind"** is cut from the Nokia page and
  its knowledge file. If something specific is true (for example, Nokia cleared the
  figures), it can come back as a plain fact.
- **The ninety-days example** (`WHY_CHATBOT`, colophon): nothing in
  `content/knowledge/` says what you'd do in a first ninety days, so the assistant
  can only say it doesn't know. Swap the example or add a FAQ entry.
- **"The static layer runs on every change"** (`app/measurements/page.tsx`): confirm
  CI really runs `npm run eval` on every push.
- **Still open from before:** "What is he not looking for?" (§1.2) and the missing
  A Darle 20 features (§1.1). "What's in it" (below) assumes the list stays partial.

### (b) Taste calls you may want to undo

- **"Everything in it" is now "What's in it"**, intro "The main features, grouped by
  area." (`components/project-media.tsx`). Keep "Everything" only once the missing
  features are in the record.
- **"I build it with AI agents in Claude Code"** (`content/adarle20.mdx`) replaced the
  resume phrase "AI-agent-heavy development workflow". Put the phrase back if you
  want it for keyword matching.
- **"Time saved"** replaces "Time given back" (`content/nokia.mdx`, At a glance).
- **"Proves" became "shows"** in the A Darle 20 closing and its knowledge file.
- **New idle line, "Type / to see the commands."** (`IDLE_LINES`), which replaces
  "The needle is at rest." It's new copy, not a reword.
- **Manual mode** (`components/shell/manual-mode.tsx`) now names both limits and the
  reset, because "the assistant comes back on its own" was false for the 10-turn
  cap. That goes past style; revert it if you want this pass purely stylistic.
- **"The resume has everything in the meantime"** (rate-limit line, `app-shell.tsx`)
  slightly overclaims; "The resume covers the basics in the meantime" is the safer
  version.
- **The permalink caveat** is now three short sentences (`export-deck.tsx`). If "It's
  frozen at the moment you made it" is too terse, "It won't include anything you ask
  after making it" says the same thing.
- **"Sprint 7"** in the off-topic refusal (`lib/refusals.ts`) means nothing to a
  visitor. Cut "added to its scope in Sprint 7" if you'd rather not cite the roadmap.
- **The model comparison no longer says it doesn't pick a winner**
  (`app/measurements/models/page.tsx`). "This page doesn't pick a winner." would put
  it back plainly.
- **Labels left as they were, your call:** "upstream" in "turn failed · upstream"
  ("server error" reads better to a recruiter), "ttft" in the phone readout ("first
  token"), and the index's "How it's built" against the colophon's "How this site was
  built".
- **Repeats on the first screen, left alone:** the case cards repeat numbers from the
  summary block,
  "sales and finance teams" appears in both the role line and the "now" row, and
  "AI-forward company" is in both the subline and a chip. Fixing any of them is a
  content change.
- **Search snippets** for `/resume` and `/projects/nokia` are accurate but bare. Making
  them name the role or outcomes would be new copy.

### (c) Where your name or voice is used

- **`/refusals`** now names you twice: the "decided by Sidhant" label, and the intro's
  "One entry is an idea Sidhant decided against, so it was never built."
- **"Operator" is gone** from the Nokia page and the knowledge base. Nothing defined
  it. If it's your word in interviews, it needs a plain sentence saying what you mean.
- **The paste-a-job-description panel stopped speaking as you.** It used to say "I'll
  map my experience onto it", and the message it sends as the visitor's turn said "Map
  my experience onto it". Both now name you in the third person (`shell-data.ts`,
  `lib/job-posting.ts`). Fit links you sent before this still show the old line, which
  is right for links you made yourself.
- **The error page** now says "That's a bug in the site." instead of "That one is on
  me, not you." (`app/error.tsx`), matching the chat's error lines, which no longer
  say "on my end".

### Cute pass: what you may want to undo

- **"Interview this site ↓" is now "Ask the AI assistant ↓"** (the text link under
  the front-door buttons, `components/shell/app-shell.tsx`). You picked the original
  in the front-door mockup, so this one is most clearly yours to reverse.
- **`/roast` is now `/critique`**, and the message it sends reads "Critique this site
  using the repo. Name the specific choices, files and trade-offs that are weak."
  (`shell-data.ts`, `lib/site-question.ts`). A visitor who types "roast" still gets
  the site corpus, and the system prompt still asks for a hard critique.
- **Both case-study closings are headed "Summary"**, not "What I'd tell a hiring
  manager" (`content/nokia.mdx`, `content/adarle20.mdx`). A chat citation of the same
  paragraph still shows the old heading, because the knowledge file's heading is a
  chunk id.
- **"Instruments" is now "Technical details"** (panel title, index entry, colophon).
  You wrote in `docs/idea-decisions.md` §4 that you like the instrumentation giving
  the site a technical feel, so this may be your word; the reason for the change is
  that "Measurements · Instruments" read as synonyms in the index.
- **The ninety-days example is still in `WHY_CHATBOT`** ("…or what I'd do in the first
  ninety days of the role you're hiring for"). Nothing in the record answers it (see
  (a)).
- **Also gone, if you miss any of them:** the resume page's "I won't take it
  personally" joke, "so the mistakes are mine", "tl;dr" (now "summary"), "Give me
  the 30-second version" (now "Give me the short version"), "Failure theatre" (now
  "Simulated failures"), the "teletype" toggle (now "sound"), "The funnel,
  instrumented" (now "Funnel tracking"), "Five models, one corpus" (now "Model
  comparison"), "slowly" in "slowly learning three languages", and the idle line
  "Ask the question you'd ask on a call." The ledger's "Cute pass" section has every
  before and after.

### Found along the way: code, not copy

- **"ttft (browser)" isn't time to first token.** The browser clock stops on the
  route's first telemetry frame, before the model starts, so it's usually smaller
  than the server's figure (`components/shell/use-conversation.ts`). The trace footnote
  now describes what it measures; moving the clock to the first text delta would fix
  the number itself.
- **The fit table's "not a score" note doesn't reach the copied scorecard or the mail
  draft** (`lib/transcript.ts`), and the printed table drops every row mark, so a
  printed "unclear" doesn't say why.
- **The job-description caveat on `/measurements`** would be false if a run without
  the grounded group were ever published. It doesn't render today.
- **On the model comparison**, frontier membership and the heatmap's per-group counts
  are shown only by colour or on hover, "22" and "Twenty-two" are typed into the
  prose, the table note blames "one sample per case" where the limit is about twenty
  turns, and the "price now" date prints raw.

### Not done, needs your go-ahead

- **The system prompt's own wording** (`lib/system-prompt.ts`): the corpus lane's
  report has a ready-to-apply "System prompt proposal" (no em dashes in answers, no
  openers or sign-offs, a plainer example decline). It wasn't shipped because it
  changes model behaviour and needs `npm run eval:live` first. The knowledge-base
  rewording in this pass already changed prompt text, so the next live eval should
  cover both.

---

## Part 1 — Facts I could not source (3)

These are sentences that were written with a hole in them, per the copy rule:
never guess a plausible fact. Each one is marked `[VERIFY]` in the file and
listed in the ledger's pending table, so none of them can quietly ship as
though it were checked.

### 1.1 What A Darle 20 actually does, beyond what's written down
**File:** `content/adarle20-media.ts` → `FEATURE_SURFACE_NOTE`, renders on `/projects/adarle20`
**The sentence:** "These are the features written down so far, and the product has more. [VERIFY: the features that exist in A Darle 20 but appear in no source file…]" (reworded in the copy pass; held off the page since wave 1 while it carries the marker)

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
*you*, on the homepage, above the fold, in a block labelled `summary` (`tl;dr`
until the cute pass). Each traces
to a corpus file and the eval suite verifies it against that file on every build.

| Label | Exact text | Traced to |
|---|---|---|
| now | "Sales operations specialist at Nokia, in Toronto. Co-founder and CTO of A Darle 20." | `bio.md` |
| shipped | "A Darle 20 — a two-sided marketplace, architected and shipped solo. 1,400+ registered users, 127 hosts and 2,100+ bookings in its first four months." | `resume.md` |
| before that | "At Nokia: a self-serve Power App used by 80+ stakeholders across seven regions, and a Salesforce Analytics to Power BI migration for 150+ users." | `projects-nokia.md` |
| how he builds | "An AI-agent-heavy workflow in Claude Code — agents write most of the code, he keeps architecture, code review and release." | `projects-adarle20.md` |
| looking for | "A RevOps / GTM systems role at an AI-forward company." | `faq.md` |
| where | "Toronto, ON. Canadian citizen, no visa sponsorship needed." | `faq.md` |

[2026-10-20: these are the July rows. Wave 2 reordered them and the copy pass
reworded "shipped" and "how he builds"; the six as they ship now are in
`docs/site-copy.md` → "Recruiter TL;DR". The question below still applies to
each.]

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
> "The link isn't encrypted. Anyone who has it can read the conversation. It's frozen at the moment you made it."

Three claims, one sentence each: not encrypted, readable by anyone with the
link, frozen when made.

**The replay banner** — `components/shell/app-shell.tsx`
> "Replayed conversation, rebuilt from the link you opened. The site stored nothing. This is a snapshot of what the model said at the time, not a live session."

"Snapshot", "the site stored nothing" and "not a live session" are each doing
separate work.

**What "found in the cited source" means** (the label that replaced "verified")
— `/measurements` and `components/shell/answer.tsx`
> "Found in the cited source means the numbers and names in a sentence appear in the source it named. It doesn't mean the sentence is true. Sentences with nothing checkable in them aren't treated as claims and aren't counted."

The narrowest claim on the site, deliberately. Upgrading it to a truth claim
would assert more than `lib/verify.ts` establishes.

**The three empty states on `/measurements`** — they say *different* things for
different reasons: no credentials, credentials but no data, query failed.
Collapsing them into one "no data" message would hide the difference between
"nobody has used it" and "the events aren't arriving."

**The refusal to publish a rate** — `/measurements`
> "With fewer than 20 checkable sentences published, the page shows no rate. 3 of 6 is too small a sample to turn into a percentage."

**The refusal ledger's code-vs-prompt distinction** — `/refusals`
> "A rule in the prompt holds only while the model follows it, and a determined visitor may find a phrasing that gets around it. A rule in code holds whether the model follows it or not."

The whole page's value rests on not blurring those two.

**The unreadable-assessment line** — `components/shell/panel-body.tsx`
> "This assessment was saved by an older version of the site and can't be shown. Paste the posting again to rebuild it."

Blames the site, not the reader, and names the way out.

---

## Part 4 — Decisions, not corrections

### 4.1 The refusal ledger entry that speaks for you
**File:** `lib/refusals.ts`, entry 7, renders on `/refusals`. **This is the one entry on that page written in your voice rather than the code's, and it needs your eye more than anything else in Sprint 7.**

> **"Make a general case against hiring him"** — *decided by Sidhant.*
> Why: "It was proposed, and Sidhant turned it down. A general argument against hiring him, on his own site and tied to no particular role, could cost him a job and wouldn't gain him anything."
> Instead: "When a real job posting is pasted, the fit assessment names the requirements he doesn't meet."

It paraphrases your own reasoning from `docs/idea-decisions.md` §2. Check it's a
fair paraphrase and that you're happy having the rejected idea published at all.
Since the copy pass the page's intro also names you ("One entry is an idea
Sidhant decided against, so it was never built."), and "self-sabotage with good
manners", your doc's phrase, is no longer on the page.

The other ten entries describe code and prompt rules; they're on `/refusals` in
full and worth a skim, but they don't put words in your mouth.

### 4.2 The critique (`/critique`, was `/roast`)
Typing `/critique` sends this as the visitor's own turn:
> "Critique this site using the repo. Name the specific choices, files and trade-offs that are weak."

The prompt constrains it to criticise the *site*, never you. It cites the
roadmap's own "what I didn't do" lists, so it will be uncomfortable in an
accurate way. **Read one and decide whether you like living with that.**

### 4.3 The four new homepage chips
Replacing "What did Sidhant build at Nokia?", "How does A Darle 20 work?",
"Is he a fit for a solutions engineering role?" with:

1. "Give me the 30-second version" (now "Give me the short version", cute pass)
2. "What has he shipped end to end?"
3. "Is he a fit for a RevOps role at an AI-forward company?" — also what `/fit` sends
4. "Does he need visa sponsorship?" (replaced in wave 2 by "What did he build at
   Nokia?")

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
Most quotes here are the July wording; the copy pass (Part 0) reworded nearly all
of them, and the ledger's copy-pass section has each one as it ships now.

### `/measurements` (Sprint 6)
Title "How the assistant is measured" (was "What this assistant scores"). Frame:
"The readouts in the chat cover only your conversation. This page reports on the
assistant as a whole…" · "All three are
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
code", five "asked of the model", one "decided by Sidhant" (§4.1).

### The export surface (Sprint 5)
Eight explanation strings in `export-deck.tsx` — empty state, markdown, print
("…gives a typeset document with working links — not a screenshot of this
page."), the link, the caveat, the over-length warning, the unsupported browser,
the scorecard, the mail draft. Plus labels: "Markdown", "Print", "Link",
"Scorecard", "copy the conversation", "download .md", "print / save as PDF",
"build a link", "copy the link", "open a mail draft".

### Manual mode — what a rate-limited visitor sees (Sprint 7)
Headline is **your existing** rate-limit line, unchanged. New below it:
"Your conversation is still here. The hourly limit is per IP address and refills
on a sliding hour. If this conversation has used all its turns, reset it to start
a new one. Meanwhile, these are the source files the answers are built from,
quoted word for word." Sections "Common questions" and "Everything else", with an
"All sources" link. Footer: "No model was called to show this, so it cost nothing.
The resume is the authoritative version."

### Project pages — "In plain terms" (Track B, #20)
A plain-language opener on each case study, before "The problem". Restatement
only — no numerals, asserted by test.

- **A Darle 20:** "Tabletop roleplaying games are played in groups, and somebody has to run the game for everyone else… The booking form is the easy part. The hard part is money…"
- **Nokia:** "A large company sells in a lot of places, and every quarter its executives need one picture of how that went… The fix isn't clever, it's just the whole job…"
- **Dell:** "A propensity model is a way of ranking that list… It was an internship… the pipeline figure below is an estimate built from average deal sizes rather than money anybody collected." ← **note this one volunteers its own caveat; check you're happy with that framing.**

### A Darle 20 feature surface (Track B, #19)
Heading "What's in it". Intro: "The main features, grouped by area." Groups: Discovery,
Booking, Payments, Communication, Accounts, Operations. See §1.1 — this list is
short on purpose and the fix is the corpus, not the page.

Media surface heading "What it looks like", with: "Frames with nothing in them
are waiting on a file. Each one says what it is for rather than showing a
stand-in, because a placeholder that looks like a product is a claim about a
product."

### Navigation and slash commands
Rail: "The instructions" (`/prompt`), "What it won't do" (`/refusals`).
Slash hints: "/prompt — Read the instructions it was given" · "/refusals — What
it won't do, and why" · "/site — How this site is built" · "/critique — Ask it
what's wrong with this site" (was "/roast") · "/jd — Paste a job description" · "/budget —
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
| Funnel tracking | screenshot | 16:9 | Whatever you actually watch to run the business. **Check this one before sending — it's the slot that would carry live numbers, and anything in it is published.** |
| The 251-player event | video | 16:9 | Footage or photographs from the convention. The largest thing the platform has run, and there is currently nothing on the site to show for it. A caption gets written from what you send, not before. |

**Already filled:** "Session listings" — the existing `public/images/adarle20-listings.png`.

Until they arrive the page shows the case study, the plain-language section, the
feature surface, and six labelled empty frames. No fake screenshot, no described
video, no stock stand-in.
