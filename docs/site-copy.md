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
Looking for a RevOps / GTM systems role at an AI-forward company. Toronto, ON —
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
Text links under it: Resume as a web page · Interview this site ↓

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

Composer fine print (empty state only, replaces the disclaimer there):
Answers cite their sources — this chat publishes its system prompt and eval
results, and shows what each answer costs. It can make mistakes; the resume is
the authoritative version.

[Four claims, all about the site, all checkable in this repo: citations ship
since Sprint 3, /prompt since Sprint 7, /measurements since Sprint 6, the cost
meter since Sprint 2. The old disclaimer sentence survives inside it.]

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

Label: tl;dr

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
| shipped | A self-serve Power App used by 80+ stakeholders across 7 regions, which ended a manual process that took one finance analyst's entire workday, every day of quarter-end close — and the migration of all sales reporting from Salesforce Analytics to Power BI for 150+ users. | `resume.md` |
| also | Co-founder and CTO of A Darle 20, a two-sided marketplace he architected and shipped solo: 1,400+ registered users, 127 hosts and 2,100+ bookings in its first four months. | `resume.md` |
| how he builds | An AI-agent-heavy workflow in Claude Code — agents write most of the code, he keeps architecture, code review and release. | `projects-adarle20.md` |
| looking for | A RevOps / GTM systems role at an AI-forward company. | `faq.md`, `resume.md` |
| where | Toronto, ON. Canadian citizen, no visa sponsorship needed. | `faq.md` |

Footer link (to /resume): The resume has the rest, and so does the box below.

### Case-study cards (under the tl;dr)

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

**Card 1 — A Darle 20**
A marketplace connecting tabletop game hosts with paying players across Latin
America. I designed and shipped the whole product solo — bookings, payments,
chat, refunds, notifications — running an AI-agent-heavy development
workflow. Four months after launch: 1,400+ registered users, 127 hosts, and
2,100+ bookings.

Role: Co-Founder & CTO
Stack: TypeScript, Next.js, Supabase, Stripe Connect
Status: Live at adarle20.com
Link: Read the case study

**Card 2 — Reporting tools at Nokia**
Self-serve reporting tools for a global sales organization. A Power App used by
80+ stakeholders across seven regions replaced a manual quarterly process, and a
migration from Salesforce Analytics to Power BI moved 150+ users onto reporting
I model and maintain.

Role: Sales operations specialist
Stack: Power Apps, Power BI, SQL, DAX, Salesforce
Status: In production since 2024
Link: Read the case study
Stat column (display numeral): 150+ / users across seven regions

**Card 3 — Sales prediction model at Dell**
As an intern, I built a propensity model on Dell's historical customer
database to find cross-sell targets for a high-margin software product — it
surfaced about 20,000 qualified accounts representing an estimated $129M in
pipeline.

Role: Marketing intern
Stack: Azure ML
[Wave 1, 2026-10-19: "Python" removed — the Dell record names Azure ML and no
language. It comes back if Sidhant confirms it.]
Status: 2018
Link: Read the case study
Stat column (display numeral): $129M / estimated pipeline

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

- Give me the 30-second version
- What has he shipped end to end?
- Is he a fit for a RevOps role at an AI-forward company?
- What did he build at Nokia?

[Wave 2, 2026-10-19: the fourth chip was "Does he need visa sponsorship?",
which the hero subline already answers. The Nokia work had no chip.]

The `/fit` slash command sends the third one verbatim, so the two can't drift
into different questions.

Input placeholder: Ask a question
Send button: send ↵
Disclaimer (small, mono): AI-generated answers about my professional background.
It can make mistakes — the resume is the authoritative version.

---

## Case study — A Darle 20

Title: A Darle 20
Subtitle: A marketplace for tabletop game sessions in Latin America.

### In plain terms

[DRAFT 2026-07-27 — written by Claude for Track B (#20). Explanation only: it
restates facts already in the sections below in plain language and introduces
none of its own. Rewrite in your own voice.]

Tabletop roleplaying games are played in groups, and somebody has to run the
game for everyone else. Finding a good one — and paying them — was word of
mouth and a private arrangement. A Darle 20 is where that arrangement happens
instead: a host lists a session, a player books a seat, the payment goes
through the site, and both sides get an email about it.

The booking form is the easy part. The hard part is money. It has to reach the
host rather than sit with the company, some players have no card at all and pay
cash at a convenience store instead, and any of it can be cancelled or refunded
by someone who isn't you. Most of what's described below is the machinery for
handling that without a person in the middle.

### The problem
Tabletop roleplaying games are big in Latin America, but finding a good game
master — and paying one — was informal and unreliable. Hosts had no clean way to
take bookings or get paid, especially in a market where many players prefer cash.
Two friends and I decided to build the marketplace ourselves.

### What I built
I architected and shipped the product end to end: host profiles, session
listings, bookings and reservations, real-time chat, email notifications,
refunds, and authentication. Payments run on Stripe Connect, handling host
payouts and platform fees — including OXXO integration so players in Mexico
can pay in cash at a convenience store, which matters in a market where card
penetration is low. The funnel is instrumented end to end — bookings,
conversion, cancellations, refunds, host activation — and that data steers
product and monetization decisions.

The build itself is part of the story. I run an AI-agent-heavy development
workflow in Claude Code — agents write most of the code, while I keep
hands-on ownership of architecture, product decisions, code review, and
release. Later I set up a multi-agent workflow that reviews, refactors, and
regression-tests the codebase on its own.

### What it runs on
TypeScript, React and Next.js, Supabase (PostgreSQL) with Prisma, Stripe Connect,
Resend for transactional email, deployed on Vercel.

### Where it stands
Development started in August 2025; the platform launched in March 2026. Four
months in, it has 1,400+ registered users, 127 hosts, and 2,100+ bookings, with
200–400 unique visitors a day. The biggest single test so far was a flagship
251-player event at a 19,000-attendee convention — I built the technology
behind it; my co-founder ran the event on the ground — rated 4.96/5 by
attendees. Running it has taught me as much about unit economics as about code:
we've tested a commission model against direct event ticket sales and made real
decisions about where the margin actually is.

### What I'd tell a hiring manager
This is the project that proves I can take an ambiguous idea to a revenue-
generating product — including the unglamorous parts like refunds, payment
edge cases, and infrastructure costs.

### Everything in it (#19 — the feature surface)

[DRAFT 2026-07-27 — assembled by Claude for Track B. Every line item is a
capability already named in `content/knowledge/projects-adarle20.md` or the
resume. Nothing was added because a marketplace probably has it.]

Section heading: Everything in it
Intro: The prose above is the story. This is the surface area — what a host or
a player can actually do.

- Discovery: Host profiles · Session listings
- Booking: Bookings and reservations · Cancellations · Automated refunds
- Payments: Stripe Connect · Host payouts · Platform fees · OXXO cash payments
  at a convenience store
- Communication: Real-time chat · Transactional email on Resend
- Accounts: Authentication
- Operations: End-to-end funnel instrumentation — bookings, conversion,
  cancellations, refunds, host activation

Closing note (draft, NOT RENDERED since wave 1, 2026-10-19 — it carries a
marker, and markers never ship on a page): This list is everything the written
record names, which is not the same as everything the product does — [VERIFY:
the features that exist in A Darle 20 but appear in no source file. Sidhant's
own note on this page was that there is a lot buried up there; nothing can be
added here until it is written down somewhere checkable.]

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
| The funnel, instrumented | screenshot | 16:9 | whatever he actually watches — live numbers, so check before sending |
| The 251-player event | video | 16:9 | footage or photographs from the convention |

Caption for the filled slot: Session listings. Each card carries the host,
their rating, the price in pesos, the schedule and how many seats are still
open.

---

## Case study — Reporting tools at Nokia

Title: Reporting tools at Nokia
Subtitle: Internal tools for a global sales organization.

### In plain terms

[DRAFT 2026-07-27 — written by Claude for Track B (#20). Explanation only.
Rewrite in your own voice.]

A large company sells in a lot of places, and every quarter its executives need
one picture of how that went. Getting to that picture meant asking people across
the regions to send their numbers in, in whatever shape they kept them, and
somebody assembling it by hand. Here that somebody was a finance analyst, and it
took their entire workday, every day of the quarter-end close.

The fix isn't clever, it's just the whole job: build something the regions can
fill in themselves, get it in front of the people who have to use it, and keep
it working when they run into trouble. The second half of this page is the same
job wearing different clothes — the company was moving off one reporting system,
and every report and every user had to come out the other side.

### The problem
Quarterly executive reporting ran on manual data collection — a process that
consumed one finance analyst's entire workday, every day of quarter-end close,
chasing inputs across regions and formats. At the same time, sales reporting
lived in Salesforce Analytics, which the organization was moving away from.

### What I built
Two main things. First, a self-serve Power App for quarterly executive reporting,
now used by 80+ stakeholders across seven regions — it replaced the manual
collection process entirely. Second, I owned the migration of all sales reporting
from Salesforce Analytics to Power BI for 150+ users: data modeling,
transformation logic in SQL and DAX, and the global rollout.

For both, I was the whole team: requirements, build, executive demos, user
support, bug triage, and iteration across time zones. More recently I've been
bringing LLMs and Python into these workflows where they earn their place.

Note: this work is internal to Nokia, so screenshots and specifics are limited
by confidentiality. The numbers above are ones I can stand behind.

### What I'd tell a hiring manager
This is what I mean by operator: I sit between the business and the tooling,
and I close that gap myself rather than filing a ticket.

---

## Case study — Sales prediction at Dell

Title: Sales prediction at Dell
Subtitle: A propensity model for cross-sell targeting, built as an intern.

### In plain terms

[DRAFT 2026-07-27 — written by Claude for Track B (#20). Explanation only; the
caveats it names are the ones already in the paragraph below it. Rewrite in
your own voice.]

A big company already sells to a lot of customers. Some of them would buy a
second product as well, and nobody knows which — so the sales team calls
everyone, or it guesses. A propensity model is a way of ranking that list:
you show it who bought what in the past, and it scores the customers who most
resemble the ones who already said yes.

That's what this was, and it's worth reading with the caveats attached. It was
an internship, the model was one piece of a much larger sales machine, and the
pipeline figure below is an estimate built from average deal sizes rather than
money anybody collected.

### The project

During a summer internship in 2018, I built a propensity model (Azure ML) on
Dell's historical customer database to identify cross-sell targets for a
high-margin software product. It surfaced about 20,000 qualified accounts
representing an estimated $129M in pipeline, based on segment-level average
deal sizes. The model was hosted on Azure so sales and marketing teams could
get predictions and feed back new training data.

It was an internship project, so I'll keep the claims modest — but it's where
I first saw that the interesting work is usually where data, revenue, and
tooling meet, and I've been working in that intersection since.

---

## About (short section or page)

I'm a sales operations specialist at Nokia in Toronto and the co-founder and
CTO of A Darle 20. I don't have a computer science degree — I have a business degree,
a bootcamp, and eight years of teaching myself whatever the next problem
required: React, SQL, the Power Platform, Stripe, and lately, building with
LLMs and coding agents.

The through line is that I like turning vague business problems into working
software, and I like owning the result — support, bugs, and all.

Outside work: basketball, chess, cooking, and slowly learning three languages.

---

## Resume page

Heading: Resume
Body: The current version, last updated July 2026. A plain-text
version lives at /resume.md if you'd rather feed it to an AI — I won't take
it personally.
Button: Download PDF

---

## Colophon (how this site was built)

Heading: How this site was built
Body:
Next.js, TypeScript, and Tailwind, deployed on Vercel. Type is Geist Sans and
Geist Mono. The chat assistant runs through Vercel's AI Gateway on
{DEFAULT_MODEL} by default, with the knowledge base injected directly into the
prompt — at this scale, a vector database would be complexity for its own
sake, so there isn't one.

[Wave 1, 2026-10-19: "runs on Claude" stopped being true when the default moved
to DeepSeek in August. The model id is now read from `DEFAULT_MODEL` in
`lib/models.ts` (`COLOPHON_STACK` in `lib/site.ts`), so the sentence stays true
whichever model is the default.]

Most of the code was written by AI agents working from a build spec; the
decisions, copy, and mistakes are mine.

[Wave 1, 2026-10-19: cut from the page, pending a decision — "The spec, design
brief, and source are on GitHub. [TODO: confirm repo is public before
linking]". The repo is public, and so is `docs/`, so whether to link it is
Sidhant's call.]

---

## Small pieces

404 page: There's nothing at this address. Head back home.
Footer: © 2026 Sidhant Mathur · Toronto, ON · GitHub · LinkedIn · Email
Chat empty state: Ask me about my work at Nokia, A Darle 20, or anything on my
resume.
Chat error states — one line per failure class, since a dropped connection on a
phone and a misconfigured server are not the same news. Each is shown under a
mono label reading "turn failed · <class>", above a "try again" button.

- connection: The connection dropped before the answer made it through. Check
  your signal and try again.
- server timeout: The server stopped responding partway through. Give it another
  try.
- upstream / unknown: Something went wrong on my end. Give it another try in a
  moment.
- misconfigured: The chat backend is misconfigured — this one is on me, not you.
- bad request: That message couldn't be sent as written. Try shortening it.

Two classes render no sentence at all: the rate limit gets the state below
instead, and a turn the reader stopped themselves gets nothing, because telling
someone what they just did is not information.

Chat stop affordance, beside the status line once a turn passes eight seconds:
stop

Chat rate-limit state: You've hit the message limit for now — the resume has
everything in the meantime.

---

## Why this site is a chatbot

[DRAFT 2026-07-27 v2 — written by Claude to Sidhant's thesis. Rewrite in your
own voice. v1 was scrapped: it framed the site as something to verify rather
than something to use, and put false modesty in the author's mouth.]

Panel heading: Why this site is a chatbot

Body:
Most software is turning into a conversation. I don't build my own PostHog
dashboards anymore — I describe what I want and the product's assistant builds
it, because it knows the platform better than I do. That pattern is going to
take over a lot of interfaces, and I don't see why a portfolio would be the
exception.

A portfolio is a list standing in for a conversation you can't have. The better
version is talking to me — about what I built, why, what it took, whether any
of it maps to what you need. You can't do that at eleven at night while you're
going through a stack of candidates. You can do this.

So come with the specific question. How the payments work. What the Nokia
rollout actually involved. What I'd do in the first ninety days of the role
you're hiring for. Skip everything you don't care about.

Every answer is built from the same source files as the resume, and it will
show you which one, so you can open the long version whenever something is
worth more than a paragraph.

---

## Job-description fit

[DRAFT 2026-07-27 — written by Claude. Rewrite in your own voice.]

Rail item: Paste a job description
Panel heading: Paste a job description
Panel body: Paste the posting and I'll map my experience onto it — including
the parts I don't match.
Textarea placeholder: Paste the job description here
Submit button: Check the fit
Message sent to the assistant (prefix before the pasted text):
Here's a job description. Map my experience onto it, and be straight about
where I don't match.
