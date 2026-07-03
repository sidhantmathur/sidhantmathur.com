# Site copy — sidhantmathur.com

Single source of truth for all site text. Sentence case everywhere. No all-caps.
No taglines beyond what's written here. [TODO] items are placeholders for Sidhant.

---

## Meta

Site title: Sidhant Mathur
Meta description: Sales operations specialist and builder. I make internal tools
and revenue systems at Nokia, and I run A Darle 20, a marketplace for tabletop
game sessions in Latin America.

---

## Homepage

### Hero

Heading:
I build internal tools, revenue systems, and the occasional whole product.

Subline:
I work in sales operations at Nokia, where tools I've built are used by 150+
people across seven regions. On the side I founded A Darle 20, a live marketplace
processing real payments in Latin America.

Metadata line (mono, small):
Sidhant Mathur · Toronto, ON · Open to new roles

Primary button: Ask me anything
(opens the chat — secondary link next to it: View resume)

### Stat block

4–6 hours per day
Time saved for finance staff at quarter-end close by a reporting tool I built
and rolled out at Nokia.

### Projects section

Section heading: Selected work

**Card 1 — A Darle 20**
A marketplace connecting tabletop game hosts with paying players across Latin
America. I designed and shipped the whole product — bookings, payments, chat,
refunds, notifications — by directing AI coding agents through the full build.

Role: Founder and developer
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

**Card 3 — Sales prediction model at Dell**
As an intern, I built a machine learning model that predicted sale outcomes at
91% accuracy and surfaced 20,000 leads worth $129M in pipeline for the sales
team.

Role: Marketing intern
Stack: Python, Azure
Status: 2018
Link: Read the case study

### Chat panel (homepage teaser)

Heading: Ask about my work
Body: I built a small assistant into this site. It knows my background and
projects, and it can answer the questions a resume can't — or just show you
around. It's also a working demo of how I build with LLMs.

Suggested questions (chips):
- What did Sidhant build at Nokia?
- How does A Darle 20 work?
- Is he a fit for a solutions engineering role?

Input placeholder: Ask a question about my work
Disclaimer (small, mono): AI-generated answers about my professional background.
It can make mistakes — the resume is the authoritative version.

---

## Case study — A Darle 20

Title: A Darle 20
Subtitle: A marketplace for tabletop game sessions in Latin America.

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
penetration is low.

The build itself is part of the story. I wrote very little of the code by hand.
I directed AI coding agents through the full build, and later set up a
multi-agent workflow in Claude Code that reviews, refactors, and regression-tests
the codebase on its own. My job was architecture, product decisions, and quality
control — the agents did the typing.

### What it runs on
TypeScript, React and Next.js, Supabase (PostgreSQL) with Prisma, Stripe Connect,
Resend for transactional email, deployed on Vercel.

### Where it stands
The platform is live and processing real payments. [TODO: one or two concrete
numbers — bookings, hosts, or revenue range — pending what we're comfortable
sharing.] Running it has taught me as much about unit economics as about code:
we've tested a commission model against direct event ticket sales, run a large
community event, and made real decisions about where the margin actually is.

### What I'd tell a hiring manager
This is the project that proves I can take an ambiguous idea to a revenue-
generating product — including the unglamorous parts like refunds, payment
edge cases, and infrastructure costs.

---

## Case study — Reporting tools at Nokia

Title: Reporting tools at Nokia
Subtitle: Internal tools for a global sales organization.

### The problem
Quarterly executive reporting ran on manual data collection. Finance staff spent
4–6 hours a day at quarter-end chasing inputs across regions and formats. At the
same time, sales reporting lived in Salesforce Analytics, which the organization
was moving away from.

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
Subtitle: A machine learning model for lead targeting, built as an intern.

During a summer internship in 2018, I built a model in Python that predicted
sale outcomes at 91% accuracy. Applied to the customer base, it surfaced about
20,000 leads representing $129M in potential pipeline. The model was hosted on
Azure so sales and marketing teams could get predictions and feed back new
training data.

It was an internship project, so I'll keep the claims modest — but it's where
I first saw that the interesting work is usually where data, revenue, and
tooling meet, and I've been working in that intersection since.

---

## About (short section or page)

I'm a sales operations specialist at Nokia in Toronto and the founder of
A Darle 20. I don't have a computer science degree — I have a business degree,
a bootcamp, and eight years of teaching myself whatever the next problem
required: React, SQL, the Power Platform, Stripe, and lately, building with
LLMs and coding agents.

The through line is that I like turning vague business problems into working
software, and I like owning the result — support, bugs, and all.

Outside work: basketball, chess, cooking, and slowly learning three languages.

---

## Resume page

Heading: Resume
Body: The current version, last updated [TODO: month year]. A plain-text
version lives at /resume.md if you'd rather feed it to an AI — I won't take
it personally.
Button: Download PDF

---

## Colophon (how this site was built)

Heading: How this site was built
Body:
Next.js, TypeScript, and Tailwind, deployed on Vercel. Type is Geist Sans and
Geist Mono. The chat assistant runs on Claude through Vercel's AI Gateway, with
the knowledge base injected directly into the prompt — at this scale, a vector
database would be complexity for its own sake, so there isn't one.

Most of the code was written by AI agents working from a build spec; the
decisions, copy, and mistakes are mine. The spec, design brief, and source are
on GitHub. [TODO: confirm repo is public before linking]

---

## Small pieces

404 page: There's nothing at this address. Head back home.
Footer: © 2026 Sidhant Mathur · Toronto, ON · GitHub · LinkedIn · Email
Chat empty state: Ask me about my work at Nokia, A Darle 20, or anything on my
resume.
Chat error state: Something went wrong on my end. Give it another try in a
moment.
Chat rate-limit state: You've hit the message limit for now — the resume has
everything in the meantime.
