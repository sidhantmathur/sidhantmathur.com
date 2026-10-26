# Site copy — sidhantmathur.com

Single source of truth for all site text. Sentence case everywhere. No all-caps.
No taglines beyond what's written here. [TODO] items are placeholders for Sidhant.

---

## Meta

Site title: Sidhant Mathur
Homepage title (tab, search result, share card): Sidhant Mathur — Sales
operations specialist at Nokia
Meta description: Sales operations specialist at Nokia. I build and run the tools a 7-region sales organization reports on. Open to RevOps, sales ops and delivery ops roles.

[Resume sync 2026-10-26. Sidhant's resume is final: one master (the Resume_Master Google Doc) and a decisions log whose verified-facts ledger is the only place detail beyond the resume may come from. Every fact in this section now comes from one of the two; older notes quoting the previous copy were dropped from this file and live in git history.] The description is the role line, the heading and the target roles in
155 characters. Same string in `og:description` and the Person JSON-LD.

llms.txt opening: "I'm a sales operations specialist at Nokia, based in
Toronto, with 5 years at the company. I build and run the tools a 7-region
sales organization reports on, and I inherit and keep alive the ones other
people built. I'm also the co-founder and sole developer of A Darle 20, a
marketplace with 2,100+ users, part-time. I'm looking for a RevOps, sales
operations or delivery operations role." Then: "At Nokia I built the weekly
operating review tool that regional sales ops teams use to compile the Chief
Customer Officer's weekly report, and launched the self-serve Power App behind
quarter-end executive reporting for 80+ stakeholders across 7 regions. I run
the sales incentive calculations for 900+ staff. Before that I ran the monthly
headcount forecast process for a 3,000–4,000-person organization."

Share card (OG image): the headshot beside "Sidhant Mathur" and "Sales
operations specialist at Nokia · Toronto, ON", then "I build and run the tools
a 7-region sales organization reports on.", then, in the accent, "Looking for a
RevOps, sales operations or delivery operations role."
Alt text: "Sidhant Mathur, sales operations specialist at Nokia: I build and run
the tools a 7-region sales organization reports on. Looking for a RevOps, sales
operations or delivery operations role."

[The three lines are the front door's role line, heading and subline from
`content/recruiter.ts`, so the card and the page say the same thing. Before
this pass the accent line rendered empty: the card cut the subline at its first
". ", and the one-sentence subline had none.]

---

## Homepage

### Hero

Chosen 2026-07-27 from docs/hero-options.md. The previous heading ("I build
internal tools, revenue systems, and the occasional whole product") entered
Sidhant into a comparison with career software engineers, which is not the
contest he wants to be judged in.

Name and role line (above the heading, beside a small square headshot):
Sidhant Mathur
Sales operations specialist at Nokia · Toronto, ON

[`ROLE_LINE` in `content/recruiter.ts`, checked against `resume.md` by the eval
suite. The title and city are the master resume's.]

Heading:
I build and run the tools a 7-region sales organization reports on.

[Resume sync 2026-10-26. Sidhant's resume is final: one master (the Resume_Master Google Doc) and a decisions log whose verified-facts ledger is the only place detail beyond the resume may come from. Every fact in this section now comes from one of the two; older notes quoting the previous copy were dropped from this file and live in git history.] The heading is the one-line story from the decisions log ("an ops person
whose edge is building"). Its second half, "and I inherit and keep alive the
ones other people built", is the summary block's `inherited` row. The previous
heading was "I build and roll out the tools sales and finance teams run on."

Subline:
Looking for a RevOps, sales operations or delivery operations role.

[The target roles are Sidhant's (2026-10-26): RevOps, sales ops and delivery
ops, with GTM systems after those; `faq.md` holds them for the chat.
"At an AI-forward company" left the line: it is in neither source.]

CTA row (under the subline):
Download resume (PDF) · hello@sidhantmathur.com [copy] · LinkedIn ↗

[Gauntlet pass, 2026-10-22: the text links under the row ("Resume as a web
page · Ask the AI assistant ↓") were removed. Five actions competed in the
hero; the web resume is in the header on every page, and the composer it
pointed at is on screen at every width.]

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

Shown in the homepage's empty state only, under the CTA row. Gone as soon as a
conversation starts. The block renders every row except `looking for` and
`where`, which live in the hero subline and role line instead. All rows stay
canonical here and stay checked by the suite against the file each names.

Label: summary

[Resume sync 2026-10-26. Sidhant's resume is final: one master (the Resume_Master Google Doc) and a decisions log whose verified-facts ledger is the only place detail beyond the resume may come from. Every fact in this section now comes from one of the two; older notes quoting the previous copy were dropped from this file and live in git history.]

| Row label | Value | From |
| --- | --- | --- |
| now | I own the reporting and tooling for Nokia's 7-region, $10B+ pipeline sales organization: incentives, quarter-end close and weekly operating review. | `resume.md` |
| built | The weekly operating review tool regional sales ops teams use to compile the Chief Customer Officer's weekly report, shipped in two weeks. | `resume.md` |
| shipped | The self-serve Power App behind quarter-end executive reporting for 80+ stakeholders across 7 regions, replacing an error-prone, full-day manual consolidation. | `resume.md` |
| inherited | The Power App and automations North America runs all its reviews on (30 core users), and the sales incentive calculations for 900+ staff. I extended the first and cut steps and manual checks from the second. | `resume.md` |
| before that | Workforce management at Nokia, Oct 2021 – Jun 2024: I ran the monthly headcount forecast for a 3,000–4,000-person org and led an analysis that identified $1.2M in real-estate cost savings. | `resume.md` |
| also | Co-founder and CTO of A Darle 20 (part-time), a marketplace I built as its sole developer. | `resume.md` |
| looking for | A RevOps, sales operations or delivery operations role. | `faq.md` |
| where | Toronto, ON. | `faq.md` |

Footer link (to /resume): The resume has the rest.

[First person, like the heading and the case studies; the chat is the only
voice that says "he". Read as a timeline, newest first. The "how I work" row
was cut: its "whole team, executive demos, global rollout" claims are in
neither source. The A Darle 20 row carries no number because its card does.]

### Case-study cards (under the summary block)

[One number each, a link to the long version. Dell stays off the homepage.
`CASE_CARDS` in `content/recruiter.ts`, checked against the file each names.]

Label: case studies

| Card | Number | Under it | From |
| --- | --- | --- | --- |
| Reporting and tooling at Nokia | 150+ | monthly users on the Salesforce CRM Analytics dashboards I delivered for exec reviews | `projects-nokia.md` |
| A Darle 20 | 2,100+ | users, with 110+ hosts and 3,600+ session reservations from 1,000+ players | `projects-adarle20.md` |

Link on each: Read the case study →

### Projects section

Section heading: Selected work

[Wave 2, 2026-10-19: on `/projects`, in the projects panel and in the index,
Nokia is now listed first (01) and A Darle 20 second (02). The card copy below
is unchanged.]

**Card 1 — A Darle 20**
A marketplace for tabletop game sessions, based in Puebla, Mexico, which I built as its sole developer and run part-time as co-founder and CTO. Since its March 2026 launch: 2,100+ users, 110+ hosts and 3,600+ session reservations from 1,000+ players.

Role: Co-founder and CTO (part-time)
Stack: Next.js, TypeScript, Supabase, Stripe Connect
Status: Live at adarle20.com
Link: Read the case study

**Card 2 — Reporting and tooling at Nokia**
I build and run the tools a 7-region sales organization reports on: the weekly operating review tool regional sales ops teams use to compile the Chief Customer Officer's weekly report, and the self-serve Power App behind quarter-end executive reporting for 80+ stakeholders. I also keep alive the ones I inherited, including the sales incentive calculations for 900+ staff.

Role: Sales operations specialist
Stack: Power Apps, Power Automate, Power BI, DAX, Salesforce CRM Analytics
Status: Current role, since Jun 2024
Link: Read the case study

**Card 3 — Sales prediction model at Dell**
An Azure ML propensity model that found about 20,000 cross-sell accounts, about $129M at the segment's average deal size. I built it as an intern and trained the sales and marketing teams to use its output for lead prioritization.

Role: Marketing intern
Stack: Azure ML
Status: Internship, May–Aug 2018
Link: Read the case study

`/projects` intro: "Three things I built: the tools a 7-region sales organization at Nokia reports on, A Darle 20, a marketplace where I'm the sole developer, and the Dell sales model where this work started." Metadata description: "Three case studies: reporting and tooling at Nokia, the A Darle 20 marketplace, and a sales prediction model at Dell."

[Resume sync 2026-10-26. Sidhant's resume is final: one master (the Resume_Master Google Doc) and a decisions log whose verified-facts ledger is the only place detail beyond the resume may come from. Every fact in this section now comes from one of the two; older notes quoting the previous copy were dropped from this file and live in git history.] Dell's figure is a sizing at the segment's average deal size, never "estimated pipeline" (decisions log). The Nokia card's stack is the master's skills line.

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
- What does he build and run at Nokia?
- Is he a fit for a RevOps role?

[Resume sync 2026-10-26: the Nokia chip was "What did he own end to end at
Nokia?". The master resume is careful about "own" (he ran the headcount
forecast his manager owned), and the new chip asks in the heading's words.]

[Gauntlet pass, 2026-10-22: the Nokia chip asked what a screener asks. The fit chip, still the `/fit` command's
question, names one role and drops "at an AI-forward company". A version
naming both role families made the model call the assessment tool twice in
one turn, run out of output budget mid-call and show nothing (caught probing
the preview); the prompt now allows one assessment per answer.]

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
Subtitle: A marketplace for tabletop game sessions, based in Puebla, Mexico.
I'm co-founder and CTO, part-time, and its sole developer.
Metadata description: A marketplace I co-founded and built as its sole
developer, part-time: 2,100+ users, 110+ hosts and 3,600+ session reservations
since its March 2026 launch.

[Resume sync 2026-10-26. Every fact now comes from the master resume or the decisions log's verified-facts ledger; older notes quoting the previous copy were dropped from this file and live in git history.] Cut because neither source has them: the old numbers and daily visitor
counts (the log excludes visitor counts), cash payments (excluded), the
problem story, platform fees and payouts, Prisma, the multi-agent audit
workflow and the pricing experiment. "Bookings" is gone everywhere: about 84%
of sessions are free, so the record's word is "session reservations". The
master's "AI-native workflows" is on /resume as written; this page says "AI
coding tools", in plain words. "Tabletop game sessions" is the one description
in neither source: it is what the product is, and Sidhant should confirm it.
The text below is content/adarle20.mdx verbatim.

### At a glance

- **Launched** — March 2026. I started building it in August 2025, and I work on
  it part-time as co-founder and CTO.
- **So far** — 2,100+ users, 110+ hosts and 3,600+ session reservations from
  1,000+ players.
- **Flagship event** — 251 players at a 19,000-attendee convention, rated
  4.96/5 by attendees. I ran the technology behind it.
- **What I own** — the architecture, code review and release. I'm the sole
  developer.

### What it is

A Darle 20 ("Let's Go 20") is a marketplace for tabletop game sessions, based in
Puebla, Mexico. Hosts list sessions and players reserve them.

### Running it on its numbers

I instrumented the funnel: conversion, refunds and host activation. The data
showed paid acquisition wasn't worth it, so growth runs on in-person marketing
and word of mouth.

### How I build it

I built the platform as its sole developer, working with AI coding tools, and I
own the architecture, code review and release. The stack is Next.js, React,
TypeScript, Supabase (PostgreSQL), Stripe Connect, Vercel, PostHog and Resend.

### In plain terms

A host lists a game session and players reserve a place in it. Paid sessions
take payment through Stripe Connect. Tracking every step from visit to
reservation showed that word of mouth brings players in better than paid ads
do.

### What's in it (#19 — the feature surface)

[Every line item is a capability the record names. Nothing is added because a
marketplace probably has it. One line per area, below the screenshot, with no
intro line.]

Section heading: What's in it

- Marketplace: Session listings · Session reservations
- Payments: Stripe Connect · Refunds
- Email: Resend
- Operations: Funnel instrumentation · Host activation · PostHog

[Resume sync 2026-10-26: cut to what the master names. Host profiles,
cancellations, host payouts, platform fees, real-time chat, authentication and
cash payments came off; they return once Sidhant writes them down somewhere
checkable.]

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

The six slots, and what each needs, live in `content/adarle20-media.ts` as
capture briefs. Summary:

| Slot | Kind | Shape | Must show |
| --- | --- | --- | --- |
| Session listings | screenshot | 152:69 | **Filled** — the existing `public/images/adarle20-listings.png` |
| Reserving a place, end to end | screen recording | 16:9 | listing → checkout → confirmation, one take, test account |
| What a host sees | screenshot | 16:9 | a host's profile, sessions and payouts |
| Host and player chat | screenshot | 9:16 | a real thread, redacted or on test accounts |
| Funnel tracking | screenshot | 16:9 | whatever he actually watches — live numbers, so check before sending |
| The 251-player event | video | 16:9 | footage or photographs from the convention |

Caption for the filled slot: Each card shows the host and their rating, the
price in pesos, the schedule, and how many seats are filled.

[Trim pass 2026-10-22 (gauntlet): the section now sits above "What's in it".
With one file on the page, the frame's own title row ("Session listings ·
screenshot · 152:69") is gone; the section heading names it. Once a second
slot has a file, each frame shows its slot title again.]

[Copy pass 2026-10-20: the caption no longer repeats the frame title "Session
listings", and it says "filled" because the cards show seats filled out of the
total ("0/6 spots"), as the alt text already did. See the copy-pass section of
docs/copy-ledger.md.]

---

## Case study — Reporting and tooling at Nokia

Title: Reporting and tooling at Nokia
Subtitle: I build and run the tools a 7-region sales organization reports on,
and keep alive the ones I inherited. Before that, I ran the monthly headcount
forecast.
Metadata description: I build and run the tools a 7-region sales organization
reports on, and keep alive the ones I inherited.

[Resume sync 2026-10-26. Every fact now comes from the master resume or the decisions log's verified-facts ledger; older notes quoting the previous copy were dropped from this file and live in git history.] New from the master: the weekly operating review tool, the incentive
calculations for 900+ staff, the North America app (30 core users), Power BI
for 5 teams, the AI agent (in testing, no results, and the page says so) and
the VBA and SharePoint work. The 150+ figure belongs to the CRM Analytics
dashboards, not a Power BI migration. Cut: "migrated all sales reporting",
"How I ran it" (whole team, executive demos, global rollout), SQL as a Nokia
tool, and "owned headcount" (he ran it; his manager owned it). Dates: Nokia
since Oct 2021. The text below is content/nokia.mdx verbatim, outcome strip
included.

<div className="@container max-w-[68ch]">
  <dl aria-label="Outcomes" className="[font-family:var(--font-geist-sans)] [text-wrap:pretty] grid grid-cols-1 border-y border-line @md:grid-cols-2">
    <div className="py-3 @md:pr-4">
      <dt className="text-[28px] font-semibold leading-none tracking-tight text-text">80+</dt>
      <dd className="t-meta mt-1.5 text-text-soft">stakeholders across 7 regions on the self-serve quarter-end reporting app I launched</dd>
    </div>
    <div className="border-t border-line py-3 @md:border-t-0 @md:border-l @md:pl-4">
      <dt className="text-[28px] font-semibold leading-none tracking-tight text-text">900+</dt>
      <dd className="t-meta mt-1.5 text-text-soft">staff whose monthly and quarterly sales incentive calculations I run</dd>
    </div>
    <div className="border-t border-line py-3 @md:pr-4">
      <dt className="text-[28px] font-semibold leading-none tracking-tight text-text">150+</dt>
      <dd className="t-meta mt-1.5 text-text-soft">monthly users on the Salesforce CRM Analytics dashboards I delivered for exec reviews</dd>
    </div>
    <div className="border-t border-line py-3 @md:border-l @md:pl-4">
      <dt className="text-[28px] font-semibold leading-none tracking-tight text-text">$1.2M</dt>
      <dd className="t-meta mt-1.5 text-text-soft">in real-estate cost savings identified by a lab and facility utilization analysis I led</dd>
    </div>
  </dl>
  <p className="t-meta mt-3 text-text-faint">Nokia, Ottawa and Toronto, ON (remote). Sales operations specialist, Jun 2024 – present. Before that, workforce management specialist, Oct 2021 – Jun 2024.</p>
</div>

### What I build and run

I own the reporting and tooling for a 7-region sales organization with $10B+ in
pipeline. That is the organization's scale, not a pipeline I carry.

**The weekly operating review.** Regional sales ops teams use the tool I built to
compile the Chief Customer Officer's weekly report. It merges CRM data with
standardized self-serve updates, which replaced ad hoc email, meetings and
slides. I shipped it within two weeks of the process launching, and regions also
run their own reviews on it. I build and maintain the tool.

**Quarter-end close.** I launched the self-serve Power App behind quarter-end
executive reporting for 80+ stakeholders across 7 regions. It replaced a
full-day manual consolidation by one finance analyst that was error-prone under
close deadlines, so close reporting no longer waits on one person.

**Reporting.** I delivered Salesforce CRM Analytics dashboards for exec reviews,
with 150+ monthly users, then moved reporting to Power BI. I also built Power BI
reports for 5 teams outside the sales organization and maintain the automation
that keeps them refreshed.

### What I inherited and kept running

**North America's review app.** I inherited the Power App and automations that
North America runs its reviews on from a developer who moved teams, and I have
extended them. North America runs its monthly reviews, incentive performance
reviews and weekly operating review on it, with about 30 core users.

**Sales incentives.** I run the monthly and quarterly sales incentive
calculations for 900+ staff: North America monthly, the other regions
quarterly. I inherited the automation and cut steps and manual checks from it.

### In testing: an AI agent

I am building an AI agent on Power BI, Glean and Teams that flags pipeline gaps
against prior years, conflicting fields and past-due dates. Power BI does the
bulk analysis and segmentation; Glean is the reasoning layer. It is in testing,
not live, and has no results yet.

### Workforce management, Oct 2021 – Jun 2024

I ran the monthly headcount forecast process, plus planning and requisitions,
for an organization of 3,000–4,000 people. Headcount was about 70% of its
budget. I automated the forecast's input checks with VBA, saving about 5 hours a
week of manual review, and I inherited and ran the SharePoint home site for the
same organization. I also led a lab and facility utilization analysis that
identified $1.2M in real-estate cost savings.

The work is internal to Nokia, so there are no screenshots.

### In plain terms

Most of this job is making sure a number means the same thing to everyone who
reads it. When each region sends its figures in its own shape, somebody has to
reconcile them by hand before leadership can trust the total. A self-serve tool
moves that work to the source: people put their numbers in once, in one place,
and nobody has to chase them.

The other half is keeping tools alive after the person who built them has moved
on. An app a region runs its reviews on can't stop working because its
developer changed teams, so I learn how it works, keep it running and extend it.

---

## Case study — Sales prediction model at Dell

Title: Sales prediction model at Dell
Subtitle: An Azure ML propensity model that found cross-sell accounts, built
during a 2018 internship.

[Resume sync 2026-10-26. Every fact now comes from the master resume or the decisions log's verified-facts ledger; older notes quoting the previous copy were dropped from this file and live in git history.] The $129M is a sizing at the segment's average deal size, never
pipeline. Round Rock, TX, not Austin. Cut: the high-margin software product,
the historical customer database, and hosting the model on Azure for feedback.
Added from the master: training the sales and marketing teams to use its
output for lead prioritization. The text below is content/dell-ml.mdx
verbatim.

### In plain terms

Some customers would buy a second product, but nobody knows which ones, so the
sales team calls everyone or guesses. A propensity model ranks the list. It
learns from who bought what in the past and scores the customers who look most
like the ones who already said yes, so sales knows which accounts to call
first. Multiplying the number of accounts by the average deal size gives a rough
sense of what the list is worth. That is a sizing, not a forecast or a pipeline.

### The project

In a 2018 summer internship at Dell Technologies in Round Rock, TX, I built a
propensity model in Azure ML that found about 20,000 cross-sell accounts. At
the segment's average deal size, those accounts are worth about $129M. That is
a sizing, not pipeline. I then trained the sales and marketing teams to use the
model's output for lead prioritization.

---

## About (short section or page)

I'm a sales operations specialist at Nokia, where I've worked since October
2021, and the co-founder and CTO of A Darle 20, part-time. I live in Toronto.

I'm an ops person whose edge is building. I build and run the tools a 7-region
sales organization reports on, and I inherit and keep alive the ones other
people built.

Outside work: building with AI, pickup basketball, classic and horror fiction,
and Canadian AI and housing policy.

[Resume sync 2026-10-26. No page renders this section; it is the first-person
mirror of `content/knowledge/bio.md`. The interests are the master resume's.
Languages are off by the decisions log's rule, and the self-taught paragraph
went because neither source carries it.]

---

## Document pages — shared chrome (wave 2, 2026-10-19)

[DRAFT 2026-10-19. Replaces the lone "← Back to the conversation", which told
a reader the chat was home and offered someone arriving from LinkedIn a
conversation they never had.]

Header: Sidhant Mathur (links home) · Resume · Projects · Contact (jumps to
the contact block at the end of the page)

Contact block, at the end of every document page:
Label: Contact
Body: I'm looking for a RevOps, sales operations or delivery operations role. Download the resume, or reach me by email or LinkedIn. [Resume sync 2026-10-26: sales operations added, matching the hero subline.]
Then: Download resume (PDF) · hello@sidhantmathur.com [copy] · LinkedIn ↗

Case studies end instead on:
Label: Contact
Body: If you're hiring for RevOps, sales operations or delivery operations, email me. The resume has the rest. [Resume sync 2026-10-26: sales operations added.]
[Gauntlet pass 2026-10-22: was "If this is the kind of work you're hiring for,
the resume has the rest." Tightened, and it now names the one action.]
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
Body: The current version, last updated October 2026. There's a plain-text
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

It works best with a specific question, such as who uses the weekly operating review tool I built, what I inherited at Nokia, or how my experience maps to the role you're hiring for.

[Resume sync 2026-10-26: the examples were "how the payments work, what the Nokia rollout involved, or what I'd do in the first ninety days". The record no longer describes A Darle 20's payment flow or a Nokia rollout, and has nothing on a first ninety days, so all three would have drawn a "the record doesn't cover it".]

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
