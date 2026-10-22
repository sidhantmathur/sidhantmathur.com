# Site copy — sidhantmathur.com

Single source of truth for all site text. Sentence case everywhere. No all-caps.
No taglines beyond what's written here. [TODO] items are placeholders for Sidhant.

---

## Meta

Site title: Sidhant Mathur
Homepage title (tab, search result, share card): Sidhant Mathur — RevOps and
sales operations
Meta description: Revenue and sales operations: I build the tools sales and
finance teams run on. Sales operations specialist at Nokia, co-founder and CTO
of A Darle 20, based in Toronto. Looking for a RevOps / GTM systems role.

[DRAFT 2026-10-19, wave 2 of the council plan. The previous description
("Sales operations specialist and builder. I make internal tools and revenue
systems at Nokia, and I'm co-founder and CTO of A Darle 20, a marketplace for
tabletop game sessions in Latin America — 2,100+ bookings in its first four
months.") led with neither role and spent half its length on tabletop games.
The same description is the Person JSON-LD's, and `llms.txt` opens with the
role line.]

Share card (OG image): the headshot beside "Sidhant Mathur" and "Revenue and
sales operations", then "I build the tools sales and finance teams run on." —
replacing the hero heading, which says nothing about the job.

---

## Homepage

### Hero

Chosen 2026-07-27 from docs/hero-options.md. The previous heading ("I build
internal tools, revenue systems, and the occasional whole product") entered
Sidhant into a comparison with career software engineers, which is not the
contest he wants to be judged in.

Name and role line (above the heading, beside a small square headshot):
Sidhant Mathur
Revenue and sales operations: I build the tools sales and finance teams run on.

[DRAFT 2026-10-19, wave 2. The council's finding: the front door named neither
him nor his role. The heading stays Sidhant's; this sits over it in the words a
recruiter searches for. `ROLE_LINE` in `content/recruiter.ts`, checked against
`resume.md` by the eval suite ("AI-native revenue operations builder"; "sales
and finance teams at Nokia").]

Heading:
I learn what the problem needs, then I build the thing.

Subline:
Looking for a RevOps / GTM systems role at an AI-forward company. Toronto, ON.
Canadian citizen, no visa sponsorship needed.

[Front-door pass, 2026-08-23 — Sidhant's call, from
`docs/mockups/front-door-1-hero.html`. The old subline ("Ask what you'd ask on
a call.") moved into the composer as the empty state's desktop placeholder —
the invitation now lives in the input it was pointing at. The new subline is
the `looking for` and `where` TL;DR rows fused into one sentence
(`POSITIONING` in `content/recruiter.ts`), checked by the eval suite like
every row.]

CTA row (under the subline):
Download resume (PDF) · hello@sidhantmathur.com [copy] · LinkedIn ↗
Text links under it: Resume as a web page · Ask the AI assistant ↓

[DRAFT 2026-10-19, wave 2. Was "View resume · Email me · Interview this site
↓". The PDF is primary because it is what a recruiter attaches to an ATS; the
HTML resume is a text link. That is an open question ("resume target") until
PostHog says which one visitors take — both are tracked. The address is on
screen with a copy button because a bare mailto: does nothing on a desktop with
no mail client. "Interview this site" is a text link now, not a third button.]

[Same pass. This reverses the 2026-07-27 note below, deliberately: a
chat-first page failed the five-second scan, and "the input is the only call
to action" is the line that made it fail. The buttons are back — resume
primary — and "Interview this site" is the chat's CTA, doing double duty as a
competence claim. The status strip still carries the name and location; the
permanent rail is gone (the index is a sheet behind the ☰ control at every
width, with Resume / Projects / Colophon / Contact in the header until a
conversation starts).]

Header (wave 2, 2026-10-19): Sidhant Mathur · Toronto, ON (lg and up) ·
Resume · Projects · Contact — at every width, before and after the first
turn. After the first turn, at lg and up, one receipt beside the nav:
"{n}/10 turns · last answer ${cost}", which opens the technical details panel
(button title "Open the technical details"). The readouts, the rate graph and
the model picker that used to replace the nav live in that panel; the picker
lists models by name ("GPT-6 Luna
(default)", "DeepSeek V4 Flash", "Claude Haiku 5.5", "GPT-5 mini", "Gemini
3.5 Flash-Lite"). "Colophon" left the header for the index.

Index (behind ☰), three groups:
- Work: Resume · Resume PDF · Nokia · A Darle 20 · Dell · Paste a job
  description
- Contact: the address with a copy button · LinkedIn ↗ · GitHub ↗
- How this site works: How it's built · The instructions · What it won't do ·
  Measurements · Technical details

"Why this site is a chatbot" is no longer an index entry; its text is a
section of the colophon.

Composer fine print (empty state only, replaces the disclaimer there):
Answers cite their sources — this chat publishes its system prompt and eval
results, and shows what each answer costs. It can make mistakes; the resume is
the authoritative version.

[Four claims, all about the site, all checkable in this repo: citations ship
since Sprint 3, /prompt since Sprint 7, /measurements since Sprint 6, the cost
meter since Sprint 2. The old disclaimer sentence survives inside it.]

[Wave 2, 2026-10-19: replaced by one line plus a link, at every width. The
four-line version took about a fifth of a phone's viewport and pushed the
tl;dr below the fold. The claims it carried are on the colophon, which the
link opens.]

Composer fine print (empty state only, wave 2):
- Below lg: AI answers can be wrong. How it works
- lg and up: Answers cite their sources but can be wrong. The resume is the
  authoritative version. How it works
("How it works" links to /colophon.)

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. In this section: the
subline and the lg fine print lost their dashes. The heading, CTA row, header
and index are unchanged.]

[Cute pass 2026-10-20: playful wording removed at Sidhant's request. No fact
changed. "Interview this site ↓" is now "Ask the AI assistant ↓" (the notes
above record the old label, which Sidhant picked in the front-door mockup). The
panel the receipt opens, "Instruments", is now titled "Technical details" in
the index, the panel title bar and the mobile sheet; its internal id is
unchanged.]

### Recruiter TL;DR (#25)

[DRAFT 2026-07-27 — assembled by Claude for Track B. Every value is lifted from
`content/knowledge/` or the resume; nothing here is drafted prose about
Sidhant. Rewrite the wording freely, but a fact that leaves this block has to
leave the corpus too.]

Shown in the homepage's empty state only, under the CTA row. Gone as soon as a
conversation starts. Since the front-door pass (2026-08-23) the block renders
four of the six rows at body scale — `looking for` and `where` live in the
hero subline instead (see above), so they are not repeated four lines apart.
All six rows stay canonical here and stay checked by the suite.

Label: summary

[Cute pass 2026-10-20: playful wording removed at Sidhant's request. No fact
changed. The label was "tl;dr", internet slang; it now matches the block's
accessible name, "Summary". This section's heading keeps "TL;DR" as the name of
decision #25. The rows are unchanged.]

[Wave 2, 2026-10-19: reordered. Nokia — the current job and the sales-ops
evidence — was labelled "before that" and sat under A Darle 20. It now leads,
labelled "now", with its outcomes in the rows; A Darle 20 follows as "also".
The old rows were: now — "Sales operations specialist at Nokia, in Toronto.
Co-founder and CTO of A Darle 20." (`bio.md`); shipped — "A Darle 20 — a
two-sided marketplace, architected and shipped solo. 1,400+ registered users,
127 hosts and 2,100+ bookings in its first four months."; before that — "At
Nokia: a self-serve Power App used by 80+ stakeholders across seven regions,
and a Salesforce Analytics to Power BI migration for 150+ users."]

| Row label | Value | From |
| --- | --- | --- |
| now | Sales operations specialist at Nokia since Jun 2024, building internal tools and automation for global sales and finance teams. | `resume.md` |
| shipped | A self-serve Power App used by 80+ stakeholders across 7 regions, replacing a manual process that took one finance analyst's entire workday, every day of quarter-end close. He also migrated all sales reporting from Salesforce Analytics to Power BI for 150+ users. | `resume.md` |
| also | Co-founder and CTO of A Darle 20, a two-sided marketplace he architected and shipped solo: 1,400+ registered users, 127 hosts and 2,100+ bookings in its first four months. | `resume.md` |
| how he builds | AI agents in Claude Code write most of the code. He owns architecture, code review and release. | `projects-adarle20.md` |
| looking for | A RevOps / GTM systems role at an AI-forward company. | `faq.md`, `resume.md` |
| where | Toronto, ON. Canadian citizen, no visa sponsorship needed. | `faq.md` |

Footer link (to /resume): The resume has the rest.

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. Rows "shipped" and
"how he builds" and the footer link changed; the other four rows did not.]

### Case-study cards (under the summary block)

[DRAFT 2026-10-19, wave 2. One number each, a link to the long version. Dell
stays off the homepage. `CASE_CARDS` in `content/recruiter.ts`, checked
against the file each names.]

Label: case studies

| Card | Number | Under it | From |
| --- | --- | --- | --- |
| Reporting tools at Nokia | 150+ | users on the sales reporting he moved from Salesforce Analytics to Power BI | `projects-nokia.md` |
| A Darle 20 | 2,100+ | bookings in the marketplace's first four months | `projects-adarle20.md` |

Link on each: Read the case study →

### Projects section

Section heading: Selected work

[Wave 2, 2026-10-19: on `/projects`, in the projects panel and in the index,
Nokia is now listed first (01) and A Darle 20 second (02). The card copy below
is unchanged.]

**Card 1 — A Darle 20**
A marketplace connecting tabletop game hosts with paying players across Latin
America. I designed and shipped the whole product solo (bookings, payments,
chat, refunds and notifications) with an AI-agent-heavy development workflow.
Four months after launch it had 1,400+ registered users, 127 hosts and 2,100+
bookings.

Role: Co-Founder & CTO
Stack: TypeScript, Next.js, Supabase, Stripe Connect
Status: Live at adarle20.com
Link: Read the case study

**Card 2 — Reporting tools at Nokia**
Self-serve reporting tools for a global sales organization. A Power App used by
80+ stakeholders across seven regions replaced a manual quarterly process. I
also moved all sales reporting from Salesforce Analytics to Power BI for 150+
users, and I model and maintain it.

Role: Sales operations specialist
Stack: Power Apps, Power BI, SQL, DAX, Salesforce
Status: In production since 2024
Link: Read the case study
Stat column (display numeral): 150+ / users across seven regions

**Card 3 — Sales prediction model at Dell**
As an intern, I built a propensity model on Dell's historical customer
database to find cross-sell targets for a high-margin software product. It
surfaced about 20,000 qualified accounts representing an estimated $129M in
pipeline.

Role: Marketing intern
Stack: Azure ML
[Wave 1, 2026-10-19: "Python" removed — the Dell record names Azure ML and no
language. It comes back if Sidhant confirms it.]
Status: 2018
Link: Read the case study
Stat column (display numeral): $129M / estimated pipeline

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. All three card
descriptions changed. The `/projects` page around them now reads: intro "Three
case studies. The assistant on the homepage can summarize any of them.";
metadata description "Three case studies: reporting tools at Nokia, the A Darle
20 marketplace, and a sales prediction model at Dell."]

### Chat panel (homepage teaser)

Heading: Ask about my work
Body: I built a small assistant into this site. It knows my background and
projects, and it can answer the questions a resume can't — or just show you
around. It's also a working demo of how I build with LLMs.

Suggested questions (chips):

[DRAFT 2026-07-27 — swapped for Track B (#26). The previous three were "What
did Sidhant build at Nokia?", "How does A Darle 20 work?" and "Is he a fit for
a solutions engineering role?" — a demo of the site's range rather than the
questions the reader arrived with. These replace them; there is no
recruiter/engineer toggle, per decisions #26.]

- Give me the short version
- What did he build at Nokia?
- Is he a fit for a RevOps role at an AI-forward company?

[Wave 2, 2026-10-19: the fourth chip was "Does he need visa sponsorship?",
which the hero subline already answers. The Nokia work had no chip.]

[2026-10-20: cut to three so the row sits on one line over the composer.
"What has he shipped end to end?" went — the Nokia chip asks the same thing
about the work that matters most. The fit chip moved last because it is the
longest; where the dock is too narrow for all three, it is the one that
drops out.]

[Cute pass 2026-10-20: playful wording removed at Sidhant's request. No fact
changed. The first chip was "Give me the 30-second version"; it is still a
request for brevity in the visitor's voice. `scripts/check-pre-hydration.mjs`
now finds the chips by /short version|shipped end to end/.]

The `/fit` slash command sends the fit chip verbatim, so the two can't drift
into different questions.

Input placeholder: Ask a question
Send button: send ↵
Disclaimer (small, mono; `DISCLAIMER` in `lib/site.ts`, now the footer of
copied, exported and printed transcripts and scorecards): These answers about my
professional background are AI-generated and can be wrong. The resume is the
authoritative version.

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. Only the disclaimer
changed in this section; the chips are unchanged.]

---

## Case study — A Darle 20

Title: A Darle 20
Subtitle: A marketplace for tabletop game sessions in Latin America.

[DRAFT 2026-10-19 — restructured by Claude after the council review: the unit
economics and the funnel instrumentation each get a section, the plain-language
explainer (#20, drafted 2026-07-27) moves below the results, and the rest is
kept. Every number and name is in content/knowledge/projects-adarle20.md or
resume.md, and evals/track-b.test.mjs checks each paragraph against them. The
text below is content/adarle20.mdx verbatim. Rewrite in your own voice.]

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. The body below is
re-copied from content/adarle20.mdx. The Stripe Connect and OXXO details now
sit once, in "The unit economics", instead of twice. The page's metadata
description now reads "A marketplace for tabletop game sessions in Latin
America, with 2,100+ bookings in its first four months."]

[Cute pass 2026-10-20: playful wording removed at Sidhant's request. No fact
changed. Two headings: "The funnel, instrumented" is now "Funnel tracking" (so
is the matching media slot's title), and "What I'd tell a hiring manager" is now
"Summary". The knowledge file keeps "What he'd tell a hiring manager", because
that heading is a chunk id, so a chat citation of the closing paragraph still
shows the old name.]

### The problem

Tabletop roleplaying games are big in Latin America, but finding and paying a
good game master was informal and unreliable. Hosts had no clean way to take
bookings or get paid, especially in a market where many players prefer cash.
Two friends and I decided to build the marketplace ourselves.

### What I built

I architected and shipped the whole product: host profiles, session listings,
bookings and reservations, payments, real-time chat, email notifications,
automated refunds, and authentication.

I build it with AI agents in Claude Code. They write most of the code, and I
handle the architecture, product decisions, code review, and release myself.
Later I set up a multi-agent workflow that reviews, refactors, and
regression-tests the codebase on its own.

### The unit economics

I integrated Stripe Connect for host payouts, the platform fee, and OXXO cash
payments. OXXO lets a player with no card pay in cash at a convenience store,
which matters in Mexico, where card penetration is low.

Running A Darle 20 has taught me as much about unit economics as about code. We
tested a commission model against direct event ticket sales and made decisions
about where the margin is.

### Funnel tracking

I instrumented the funnel end to end: bookings, conversion, cancellations,
refunds and host activation. That covers both sides of the marketplace, so I
can see how many players visit, register and book, and how many hosts
activate. I use that data to make product and monetization decisions,
including the commission question above.

### What it runs on

TypeScript, React and Next.js, Supabase (PostgreSQL) with Prisma, Stripe Connect,
Resend for transactional email, deployed on Vercel.

### Where it stands

I started building in August 2025, and the platform launched in March 2026.
Four months in, it has 1,400+ registered users, 127 hosts, and 2,100+ bookings,
with 200–400 unique visitors a day. The biggest single test so far was a
flagship 251-player event at a 19,000-attendee convention, rated 4.96/5 by
attendees. I built the technology behind it, and my co-founder ran the event on
the ground.

### In plain terms

Tabletop roleplaying games are played in groups, and somebody has to run the
game for everyone else. Finding a good one, and paying them, came down to word
of mouth and private arrangements. On A Darle 20, a host lists a session, a
player books a seat, the payment goes through the site, and both sides get an
email about it.

Money is the hard part. It has to get to the host, some players have no card
and pay cash at a convenience store, and bookings get cancelled and refunded.
Most of what I built handles that automatically.

### Summary

A Darle 20 shows I can take an ambiguous idea to a revenue-generating product
and handle the refunds, payment edge cases, and infrastructure costs that come
with it.

### What's in it (#19 — the feature surface)

[DRAFT 2026-07-27 — assembled by Claude for Track B. Every line item is a
capability already named in `content/knowledge/projects-adarle20.md` or the
resume. Nothing was added because a marketplace probably has it.]

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. The heading was
"Everything in it" and the intro was "The prose above is the story. This is the
surface area — what a host or a player can actually do." "Everything"
overclaimed, since the list holds only what the record names. The Operations
item's dash became parentheses. The unrendered note was reworded; its marker is
untouched.]

Section heading: What's in it
Intro: The main features, grouped by area.

- Discovery: Host profiles · Session listings
- Booking: Bookings and reservations · Cancellations · Automated refunds
- Payments: Stripe Connect · Host payouts · Platform fees · OXXO cash payments
  at a convenience store
- Communication: Real-time chat · Transactional email on Resend
- Accounts: Authentication
- Operations: End-to-end funnel instrumentation (bookings, conversion,
  cancellations, refunds, host activation)

Closing note (draft, NOT RENDERED since wave 1, 2026-10-19 — it carries a
marker, and markers never ship on a page): These are the features written down
so far, and the product has more. [VERIFY: the features that exist in A Darle
20 but appear in no source file. Sidhant's own note on this page was that there
is a lot buried up there; nothing can be added here until it is written down
somewhere checkable.]

### What it looks like (#19 — the media surface)

[DRAFT 2026-07-27 — written by Claude for Track B. The frames ship; the files
are Sidhant's. No caption below describes an asset that does not exist.]

Section heading: What it looks like

[Wave 1, 2026-10-19: only slots with a file render. The empty frames, their
"Nothing here yet" text and the intro about them came off the page — on the
flagship case study they read as unfinished work. The retired strings were:
intro "Frames with nothing in them are waiting on a file…", empty-frame text
"Nothing here yet — waiting on a {kind}.", empty caption "{slot title} — not
captured yet." A slot appears the day its file is added.]

The seven slots, and what each needs, live in `content/adarle20-media.ts` as
capture briefs. Summary:

| Slot | Kind | Shape | Must show |
| --- | --- | --- | --- |
| Session listings | screenshot | 152:69 | **Filled** — the existing `public/images/adarle20-listings.png` |
| Booking a seat, end to end | screen recording | 16:9 | listing → checkout → confirmation, one take, test account |
| Paying in cash | screenshot | 9:16 | the OXXO reference handed to the player |
| What a host sees | screenshot | 16:9 | a host's profile, sessions and payouts |
| Host and player chat | screenshot | 9:16 | a real thread, redacted or on test accounts |
| Funnel tracking | screenshot | 16:9 | whatever he actually watches — live numbers, so check before sending |
| The 251-player event | video | 16:9 | footage or photographs from the convention |

Caption for the filled slot: Each card shows the host and their rating, the
price in pesos, the schedule, and how many seats are filled.

[Copy pass 2026-10-20: the caption no longer repeats the frame title "Session
listings", and it says "filled" because the cards show seats filled out of the
total ("0/6 spots"), as the alt text already did. See the copy-pass section of
docs/copy-ledger.md.]

---

## Case study — Reporting tools at Nokia

Title: Reporting tools at Nokia
Subtitle: I eliminated a manual quarter-end reporting process and moved sales
reporting for 150+ users onto a data model I own.

[Gauntlet pass 2026-10-22 — restructured by Claude. The page said the same fact
four times ("At a glance", "Before and after", "In plain terms", "Summary").
Now: an outcome strip, one "What changed" section, "How I ran it" promoted to a
five-stage delivery method, the workforce management role given its own
section, and a plain-language section that explains the work instead of
restating it. "Summary" is cut; its point is carried by "How I ran it". No new
facts: every number and name is in content/knowledge/projects-nokia.md,
resume.md or bio.md. The text below is content/nokia.mdx verbatim. Rewrite in
your own voice.]

Outcome strip (top of the page, three cells, then a role line):

- **80+** — stakeholders in seven regions on self-serve quarterly reporting
- **One workday** — of a finance analyst's time back, every day of quarter-end
  close
- **150+** — users on sales reporting I rebuilt and moved to a new platform

Role line: Sales operations specialist (internal tools and automation), Nokia,
Toronto. June 2024 to present. Both tools have been in production since 2024.

### What changed

**Quarterly executive reporting.** Leadership needed one picture of the quarter
from every region, and the inputs arrived by hand, in whatever format each
region kept them. A finance analyst chased and assembled them. I replaced that
process with a self-serve Power App the regions report through directly, and
the manual collection is gone.

**Sales reporting.** The organization was moving off Salesforce Analytics. I
migrated all of its sales reporting to Power BI and owned the data model and
the transformation logic, in SQL and DAX, end to end.

This work is internal to Nokia, so confidentiality limits the screenshots and
specifics I can share.

### How I ran it

For both tools I was the whole team, from the first request to support after
launch.

- **Requirements** — sales and finance leadership came with vague requests,
  and I turned each one into a scoped plan.
- **Build** — the Power App, and the Power BI data model with its SQL and DAX
  transformation logic.
- **Executive demos** — I showed each tool to leadership before it went out.
- **Global rollout** — I rolled both out to stakeholders across regions.
- **Support** — I handle user support, bug triage and rapid iteration myself,
  across time zones.

More recently I've been bringing LLMs and Python into these workflows where
they help.

### Before this: headcount and forecasting

I joined Nokia in October 2022 as a workforce management specialist. Until June
2024 I owned headcount reporting and forecasting for an organization of
3,000–4,000 people.

The questions were operating questions: how many people the organization has,
how many it will have, and whether the space it pays for is being used. On that
last one, I analyzed lab and facility utilization data and identified $1.2M in
real-estate cost savings.

### In plain terms

Most of this job is making sure a number means the same thing to everyone who
reads it. When each region sends its figures in its own shape, somebody has to
reconcile them by hand before leadership can trust the total. A self-serve tool
moves that work to the source: people put their numbers in once, in one place,
and nobody has to chase them.

A reporting migration is harder than it sounds. Every report carries rules
inside it, like what counts as a sale or which region an account belongs to.
Those rules have to be rebuilt on the new system, and the new numbers have to
match the old ones before people trust them. The rebuilt rules are the data
model, and that's the part I own.

---

## Case study — Sales prediction at Dell

Title: Sales prediction at Dell
Subtitle: A propensity model for cross-sell targeting, built as an intern.

### In plain terms

[DRAFT 2026-07-27 — written by Claude for Track B (#20). Explanation only; the
caveats it names are the ones already in the paragraph below it. Rewrite in
your own voice.]

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. The body below is
content/dell-ml.mdx verbatim. The internship caveat is now said once, here,
instead of twice.]

Some of a big company's customers would buy a second product, but nobody knows
which ones, so the sales team calls everyone or guesses. A propensity model
ranks that list. You show it who bought what in the past, and it scores the
customers who look most like the ones who already said yes.

I built one of these as an intern at Dell. The model was one piece of a much
bigger sales process, and the pipeline figure below is an estimate from average
deal sizes, not money anyone collected.

### The project

During a summer internship in 2018, I built a propensity model (Azure ML) on
Dell's historical customer database to identify cross-sell targets for a
high-margin software product. It surfaced about 20,000 qualified accounts
representing an estimated $129M in pipeline, based on segment-level average
deal sizes. The model was hosted on Azure so sales and marketing teams could
get predictions and feed back new training data.

The internship is where I first got interested in work that combines data,
revenue and tooling, and I've been doing it since.

---

## About (short section or page)

I'm a sales operations specialist at Nokia in Toronto and the co-founder and
CTO of A Darle 20. I don't have a computer science degree. I have a business
degree, a bootcamp, and eight years of teaching myself whatever the next problem
required: React, SQL, the Power Platform, Stripe, and lately, building with
LLMs and coding agents.

I like turning vague business problems into working software, then owning it,
including the support and the bug fixes.

Outside work: basketball, chess, cooking, and learning three languages.

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. No page renders this
section today; it is the first-person mirror of `content/knowledge/bio.md`.
The pass reworded bio.md's "The through line is that… support, bugs, and all"
paragraph, and this section follows it. The degree sentence now breaks at a full
stop, as bio.md's always has.]

[Cute pass 2026-10-20: playful wording removed at Sidhant's request. No fact
changed. "slowly learning three languages" lost "slowly", here and in bio.md.]

---

## Document pages — shared chrome (wave 2, 2026-10-19)

[DRAFT 2026-10-19. Replaces the lone "← Back to the conversation", which told
a reader the chat was home and offered someone arriving from LinkedIn a
conversation they never had.]

Header: Sidhant Mathur (links home) · Resume · Projects · Contact (jumps to
the contact block at the end of the page)

Contact block, at the end of every document page:
Label: Contact
Body: I'm open to new roles. Download the resume, or reach me by email or
LinkedIn.
Then: Download resume (PDF) · hello@sidhantmathur.com [copy] · LinkedIn ↗

Case studies end instead on:
Label: Contact
Body: If this is the kind of work you're hiring for, the resume has the rest.
Then the same three controls, and a bordered link: "Next case study" ·
{next title} → · {its status line}. Order: Nokia → A Darle 20 → Dell → Nokia.

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. Only the contact
block's body changed; the case-study ending is unchanged.]

---

## Resume page

Label: Resume
Heading: Sidhant Mathur
[Wave 2: the heading was "Resume", so the page carried no name above the
contact line.]
Body: The current version, last updated July 2026. There's a plain-text
version at /resume.md for pasting into an AI tool.
Button: Download PDF

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. The joke stays; the
dash went.]

[Cute pass 2026-10-20: playful wording removed at Sidhant's request. No fact
changed. The joke went too: "if you'd rather feed it to an AI. I won't take it
personally." is now "for pasting into an AI tool."]

---

## Colophon (how this site was built)

Heading: How this site was built
Body:
Next.js, TypeScript, and Tailwind, deployed on Vercel. Type is Geist Sans and
Geist Mono. The chat assistant runs through Vercel's AI Gateway on
{DEFAULT_MODEL} by default. The knowledge base goes straight into the prompt.
At this size a vector database would only add complexity, so there isn't one.

[Wave 1, 2026-10-19: "runs on Claude" stopped being true when the default moved
to DeepSeek in August. The model id is now read from `DEFAULT_MODEL` in
`lib/models.ts` (`COLOPHON_STACK` in `lib/site.ts`), so the sentence stays true
whichever model is the default.]

Most of the code was written by AI agents working from a build spec. I made the
decisions.

[Wave 1, 2026-10-19: cut from the page, pending a decision — "The spec, design
brief, and source are on GitHub. [TODO: confirm repo is public before
linking]". The repo is public, and so is `docs/`, so whether to link it is
Sidhant's call.]

The assistant is tested against a fixed set of questions, and the results are
published on the measurements page. (Link text: "measurements page", to
/measurements.)

Section heading: Where to see how the assistant works
Body: The instructions the assistant runs on are published in full, and so is a
list of what it won't answer, with the reason for each. In the chat, the top
bar shows what the last answer cost, and the technical details panel lists the
cost of every turn. The eval results show how it scores. (Links:
"instructions" to /prompt, "won't answer" to /refusals, "eval results" to
/measurements.)

Then "Why there's a chat on a portfolio" (below).

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. The last two
paragraphs were not recorded here before (the ledger has had them since Sprint
6 and the 2026-07-28 pass); they are added so the page is here whole. Two
things changed beyond style: "copy" left the credit line,
because almost all of the site's copy is still Claude's draft, and the cost
sentence no longer says each turn's cost is "printed next to the turn", which
it isn't.]

[Cute pass 2026-10-20: playful wording removed at Sidhant's request. No fact
changed. The credit line lost its joke ("so the mistakes are mine"). The heading
was "The site shows its workings". In the body, "the instruments panel" follows
that panel's new name, and "The eval results show how often it's right" became
"…show how it scores", because the site's own caveats say a pass rate isn't a
measure of accuracy.]

---

## Small pieces

404 page: There's nothing at this address. Go to the homepage → · Read the
resume →
Footer: © 2026 Sidhant Mathur · Toronto, ON · GitHub · LinkedIn · Email
Chat empty state: Ask me about my work at Nokia, A Darle 20, or anything on my
resume.
Chat error states — one line per failure class, since a dropped connection on a
phone and a misconfigured server are not the same news. Each is shown under a
mono label reading "turn failed · <class>", above a "try again" button.

- connection: The connection dropped before the answer made it through. Check
  your signal and try again.
- server timeout: The server took too long to respond. Try again.
- upstream: Something went wrong on the server. Try again in a moment.
- unknown (also the fallback for any class without its own sentence): Something
  went wrong. Try again in a moment.
- misconfigured: The chat server is misconfigured. Your message is fine.
- no answer: The model hit the site's output limit before it got to an answer.
  There's nothing wrong with your question.
- bad request: That message couldn't be sent as written. Try shortening it.

Two classes render no sentence at all: the rate limit gets the state below
instead, and a turn the reader stopped themselves gets nothing, because telling
someone what they just did is not information.

Chat stop affordance, beside the status line once a turn passes eight seconds:
stop

Chat rate-limit state: You've hit the message limit for now. The resume has
everything in the meantime.

Error page (`app/error.tsx`, when the conversation fails to start in the
browser): Something broke in the browser and the conversation didn't start.
That's a bug in the site.

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. The error sentences
no longer speak in the first person ("on my end", "on me, not you"), which in
the chat column read as the assistant talking. "Upstream" and "unknown" now
have different sentences. "no answer" was missing from this list (it was added
in wave 1) and is here now. The timeout sentence dropped "partway through",
because the class also covers a request that never started. The error page
line was not recorded here before.]

[Cute pass 2026-10-20: playful wording removed at Sidhant's request. No fact
changed. "Give it another try" became "Try again" in the three sentences that
had it, matching the connection sentence. The 404's first link was "Head back
home →".]

---

## Why this site is a chatbot

[DRAFT 2026-07-27 v2 — written by Claude to Sidhant's thesis. Rewrite in your
own voice. v1 was scrapped: it framed the site as something to verify rather
than something to use, and put false modesty in the author's mouth.]

[Wave 2, 2026-10-19: folded into the colophon, page and panel, under the
heading "Why there's a chat on a portfolio". It is no longer its own entry in
the index — it argues for the chat-first premise the front-door policy
reversed, so it sits with how the site works rather than beside the resume.
The body below is unchanged.]

Panel heading (until wave 2): Why this site is a chatbot

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. The second paragraph
now names the assistant, so the chat no longer reads as Sidhant ("The better
version is talking to me… You can do this.").]

[Cute pass 2026-10-20: playful wording removed at Sidhant's request. No fact
changed. Paragraph 2 lost the aphorism ("A portfolio is a list standing in for a
conversation you can't have") and the eleven-at-night scene; paragraph 3 lost
"So come with…". The ninety-days example is still there, and nothing in
`content/knowledge/` answers it.]

Body:
Most software is turning into a conversation. I don't build my own PostHog
dashboards anymore. I describe what I want and the product's assistant builds
it, because it knows the platform better than I do. I think a lot of interfaces
will go the same way, portfolios included.

Questions about a portfolio usually have to wait for a call. If you're going
through candidates and can't call me, you can ask the assistant whether any of
my work maps to what you need.

It works best with a specific question, such as how the payments work, what the
Nokia rollout involved, or what I'd do in the first ninety days of the role
you're hiring for.

Every answer is built from the same source files as the resume and shows which
ones it drew on, so you can open the file when a paragraph isn't enough.

---

## Job-description fit

[DRAFT 2026-07-27 — written by Claude. Rewrite in your own voice.]

Rail item: Paste a job description
Panel heading: Paste a job description
Panel body: Paste the posting and the assistant will check it against
Sidhant's record and list the requirements he doesn't meet.
Textarea placeholder: Paste the job description here
Submit button: Check the fit
Message sent to the assistant (prefix before the pasted text):
Here's a job description. Where does Sidhant match it, and where doesn't he?

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. Both strings used to
speak as Sidhant ("I'll map my experience", "Map my experience onto it, and be
straight about where I don't match"), and the prefix is sent as the visitor's
own turn, so a recruiter's message said "my experience". The old prefix is kept
as `LEGACY_JD_PREFIXES` in `lib/job-posting.ts`, so fit links sent before the
change still replay with the posting-left-out line. The shorter prefix (78
characters with its blank-line separator, was 97) raises the form's posting cap
from 3,903 to 3,922.]

### Replayed fit check and the short link (application links, 2026-10-19)

[DRAFT — written by Claude. See docs/application-links.md for what these are
for.]

Banner line, over a replayed fit check: A fit check: the assistant on Sidhant
Mathur's site read one job posting against his record, citing a source for
every match and listing the gaps.
The replay banner itself (every replayed conversation, `REPLAY_BANNER`):
Replayed conversation, rebuilt from the link you opened. The site stored
nothing. This is a snapshot of what the model said at the time, not a live
session.
Added to the replay banner when the posting was left out: The link leaves out
the posting. Each requirement in the table is quoted from it.
Then, in the banner: Download resume (PDF) · hello@sidhantmathur.com [copy] ·
LinkedIn ↗, and the reset button "start a new conversation"
Replayed turn label: 01 · asked (a live turn is still "01 · you")
Over an excerpt table: Showing 3 of 14 requirements, the strongest cited ones.
The counts cover all 14, and every gap is listed below.
(With no rows: This link carries the counts for all 14 requirements and every
gap, but none of the rows.)
Export panel, "Short link": The same scorecard as a link, with the answer's
summary. It's short enough for an application form or a plain-text email, and
it leaves the posting out. Buttons: build a short link · rebuild the short
link · copy the short link.

[Copy pass 2026-10-20: reworded to read less like AI-generated text. No fact
changed. See the copy-pass section of docs/copy-ledger.md. The replay banner
keeps all four of its claims (a replay, rebuilt from the link, the site stored
nothing, a snapshot and not a live session); it was not recorded here before.
The fit-check banner line is unchanged.]

[Cute pass 2026-10-20: playful wording removed at Sidhant's request. No fact
changed. The banner's reset button was "start a fresh one"; it sits on the page
a stranger opens from an application link, so it now says what it does.]
