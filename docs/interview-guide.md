# Interview guide

The chat knows your resume bullets and nothing behind them. A hiring manager for
a RevOps or delivery ops role asks "walk me through it" and "tell me about a
time", and right now the chat can only repeat the bullet back.

This file is the interview that fixes that. It asks; it never answers. Every
story you tell here improves three things at once: the chat's answers, the
citations behind them, and the case studies.

**How to use this:** one sitting, by voice or by typing. The next section says
how to set it up. Then work through the stories in order, the gap prompts, and
two short questions about why you want these roles. Blanks look like `______`.
Skip anything with "skip"; "none" and "I don't know" are complete answers.

Total: about 85 minutes. Short on time? Stories 1 to 6 plus the gap prompts take
about 60, and the rest can be a second sitting.

---

## How to run it · 5 min

### By voice (recommended)

Talking is faster than typing, and stories come out better told than written.

1. Open a new chat in the Claude app. Attach this file (or paste it in).
2. Paste the interviewer prompt below, then switch to voice mode.
3. Talk. It asks one question at a time and keeps notes.
4. At the end, ask for the paste-back. Read it once, about 5 minutes, and fix
   anything it misheard. Names and numbers are where voice transcription slips.
5. Hand the paste-back to the agent that ingests it (section "After the
   interview" is its checklist).

### By typing

Copy this file **outside the repo**, or into `docs/source/`, which git ignores,
and fill in the blanks there. Don't fill them in here: this file is public.

### The interviewer prompt

```
You're interviewing me, Sidhant, to turn my resume bullets into stories for my
portfolio site's chat. The attached guide has the questions. Rules:

- Ask one question at a time, in the guide's order, and say its number first
  ("1.3"). Start at story 1 unless I say otherwise.
- Never suggest an answer, a number, or a stronger word for what I did. Don't
  praise or rephrase my answers. If I'm stuck, move on.
- If an answer is vague, follow up once with "what's a specific example?" or
  "how do you know?", then move on.
- When I give a number, ask where it comes from. If I'm not sure, write it
  down as "not sure". Never round a guess into a fact.
- "Skip", "none" and "I don't know" are complete answers. Write them down.
- Keep each story to the time the guide gives it, and tell me when we're over.
- At the end of each story, read back my one-breath version and the numbers I
  gave, and ask me to correct them.
- If I say something is private, mark it "private" and keep it out of
  everything except the private line.
- At the end, write everything out in the guide's paste-back format, in my
  words. Don't polish, don't summarize away detail, and add nothing I didn't
  say.
```

### The paste-back format

A header, then each story's block exactly as this guide shows it, in order, then
the gap prompts block and the why block. Unanswered lines stay as `______`.

```
Interview answers, ______ (date)
Mode: voice / typed
Read back and checked by me: yes / no
```

### Before you start: what's public, and what's already off the record

**Public.** The site's repo is public, and `/prompt` publishes the chat's
knowledge base word for word. Anything that reaches the stories file is
readable by anyone. Use roles, not names ("a finance analyst", "my manager",
"a regional sales ops lead"). Leave out anything Nokia would treat as
confidential: customer names, revenue, internal figures you wouldn't say in an
interview. When in doubt, say it and mark it private.

**Off the record by an earlier decision.** No question here asks for these. If
you mention one, it stays out of every file unless you say "override" and why:

- Languages you speak.
- Fees, savings or any dollar result from your freelance work.
- A Darle 20's revenue, GMV, MRR, cash payments or visitor counts.
- Who receives the weekly report beyond the Chief Customer Officer, and what any
  meeting does with it.
- Hours saved by the weekly operating review tool.
- Revenue figures for North America.
- Plans for the AI agent beyond what it does in testing.

(The full list is section 5 of the Resume — Decisions Log, kept locally in
`docs/source/`.)

**Corrections are welcome.** Each story starts with what's already on record.
If any of it is wrong or scoped badly, say so. A correction is worth as much as
a story.

---

## The stories, in order

Ordered by what a RevOps or delivery ops hiring manager asks about most:
processes replaced and adopted first, then sales comp and forecasting, then AI
with receipts, then the rest.

| # | Story | Time |
| --- | --- | --- |
| 1 | Quarter-end close app | 8 min |
| 2 | Weekly operating review tool | 8 min |
| 3 | Sales incentive calculations | 8 min |
| 4 | Headcount forecast | 8 min |
| 5 | Building A Darle 20 with AI tools | 7 min |
| 6 | North America review app | 6 min |
| 7 | A Darle 20's funnel and growth decision | 6 min |
| 8 | CRM Analytics to Power BI | 6 min |
| 9 | The convention event | 6 min |
| 10 | Utilization analysis | 4 min |
| 11 | AI agent in testing | 4 min |

Every story asks the same six things, in the same order: the situation before;
what you did yourself and what others did; the hardest call; who pushed back;
what changed and how you know; what you'd do differently. Then one breath: the
whole story in about ten seconds, the version you'd give before anyone asks a
follow-up.

**Numbers:** only ones you'd stand behind if a hiring manager asked "how do you
know?" A number you're unsure of is worse than none. Say "not sure" and it
stays out.

A few A Darle 20 questions were sharpened by reading the product's own docs.
They're still only questions: nothing from that repo becomes a claim until you
say it.

---

## 1. Quarter-end close app · 8 min

**Already on record:** a self-serve Power App behind quarter-end executive
reporting, used by 80+ stakeholders across 7 regions. It replaced a full-day
manual consolidation by one finance analyst that was error-prone under close
deadlines. Close reporting no longer waits on one person.

1. **Before.** Walk through one quarter-end close before the app. Who sent what
   to the analyst, in what shape, and what went wrong under deadline? One real
   error, if you remember one. And who decided it should change: did someone
   ask for this, or did you propose it?
2. **Yours and others'.** What did you build yourself? Who else was involved
   (the analyst, finance, regional teams, IT), and what did each of them do?
3. **The hard call.** What did you decide to standardize across 7 regions, and
   what did you leave flexible? What did you cut from the first version?
4. **Pushback.** Who didn't want to move to self-serve? What got 80+ people to
   submit through the app instead of email: training, a deadline, a mandate,
   something else?
5. **What changed, and how you know.** What happened at the first close on the
   app? What does the analyst do with that day now? What can you count (closes
   run on it, errors caught, time) that you'd stand behind?
6. **Differently.** Starting over, what would you change?

**One breath:** "Before, ______. I built ______. Now ______."

```
1. Quarter-end close app
1.1 Before: ______
1.2 Yours and others': ______
1.3 Hard call: ______
1.4 Pushback: ______
1.5 What changed, and how I know: ______
1.6 Differently: ______
One breath: ______
Numbers, each with where it comes from: ______
Corrections to the record: ______
Private, never publish: ______
```

---

## 2. Weekly operating review tool · 8 min

**Already on record:** regional sales ops teams use it to compile the Chief
Customer Officer's weekly report. It merges CRM data with standardized
self-serve updates, which replaced ad hoc email, meetings and slides. You
shipped it within two weeks of the process launching, and regions also run
their own reviews on it. You build and maintain it; you don't attend or own the
meeting.

1. **Before.** When the process launched, how were regions getting their
   numbers into the report? What did "ad hoc" look like in a normal week?
2. **Yours and others'.** Who defined what the report had to contain? Which
   parts of the tool did you design, and which were handed to you?
3. **The hard call.** Two weeks is short. What did you decide on day one, and
   what did you leave out of version one? Did any of it come back? And when the
   CRM said one thing and a region's update said another, what did the tool do,
   and who set that rule?
4. **Pushback.** Did any region resist the standard format? Regions now run
   their own reviews on it: did someone ask for that, or did they start on
   their own?
5. **What changed, and how you know.** What's different now, in terms you can
   back up? (Hours saved by this tool are off the record. Give a figure only if
   you want that changed, and say "override".)
6. **Differently.** What would you change?

**One breath:** "Regions used to ______. In two weeks I built ______. Now
______."

```
2. Weekly operating review tool
2.1 Before: ______
2.2 Yours and others': ______
2.3 Hard call: ______
2.4 Pushback: ______
2.5 What changed, and how I know: ______
2.6 Differently: ______
One breath: ______
Numbers, each with where it comes from: ______
Corrections to the record: ______
Private, never publish: ______
```

---

## 3. Sales incentive calculations · 8 min

**Already on record:** you run the queries and automations behind monthly and
quarterly sales incentive calculations for 900+ staff: about 200 account
managers and about 700 pre-sales and customer success staff. North America is
monthly, the other regions quarterly. You inherited the process, cut steps and
manual checks from the automation, and made it faster. You have no authority
over incentive design.

1. **Before.** What did the process look like when you got it: how many steps,
   which manual checks, how long a cycle took? Where does the input data come
   from?
2. **Yours and others'.** Where does your part start and stop? Who owns plan
   design, who approves payouts, and who answers when someone disputes their
   number?
3. **The hard call.** Which manual checks did you cut, and how did you convince
   yourself, and anyone else, that it was safe to stop checking by hand? What
   replaced them?
4. **Pushback.** Has a calculated payout ever been questioned, by a rep, a
   manager or finance? What happened? No names, no amounts.
5. **What changed, and how you know.** "Faster" by how much, in terms you can
   back up: days in the cycle, steps, checks? Has an error got through since?
6. **Differently.** What would you change?

**One breath:** "I run incentive calculations for 900+ people. When I got it,
______. Now ______."

```
3. Sales incentive calculations
3.1 Before: ______
3.2 Yours and others': ______
3.3 Hard call: ______
3.4 Pushback: ______
3.5 What changed, and how I know: ______
3.6 Differently: ______
One breath: ______
Numbers, each with where it comes from: ______
Corrections to the record: ______
Private, never publish: ______
```

---

## 4. Headcount forecast · 8 min

**Already on record:** as a workforce management specialist (Oct 2021 – Jun
2024) you ran the monthly headcount forecast process, plus planning and
requisitions, for a 3,000–4,000-person organization. Headcount was about 70% of
its budget. Your manager owned the process; you did nearly all the work. You
automated the forecast's input checks with VBA, saving about 5 hours a week:
your predecessor spent about an hour a day checking team inputs by hand.

1. **Before.** Walk through one monthly cycle: who submitted what, by when, and
   where did it go? What did "planning and requisitions" involve? What did the
   hour a day of checking actually catch?
2. **Yours and others'.** Your manager owned it. In practice, what did your
   manager decide that you didn't?
3. **The hard call.** What did the VBA checks look for? What did you choose to
   flag for a person versus fix automatically?
4. **Pushback.** Did teams push back on deadlines, the format, or the forecast
   itself? One time a number got challenged, and how it ended.
5. **What changed, and how you know.** Was the forecast ever compared to
   actuals? Did it drive a decision you saw, such as hiring, requisition
   approvals or budget? "We never measured it" is a fine answer.
6. **Differently.** What would you change?

**One breath:** "Every month I ran the headcount forecast for 3,000–4,000
people. ______."

```
4. Headcount forecast
4.1 Before: ______
4.2 Yours and others': ______
4.3 Hard call: ______
4.4 Pushback: ______
4.5 What changed, and how I know: ______
4.6 Differently: ______
One breath: ______
Numbers, each with where it comes from: ______
Corrections to the record: ______
Private, never publish: ______
```

---

## 5. Building A Darle 20 with AI tools · 7 min

**Already on record:** co-founder and CTO, part-time and remote, and the sole
developer. You started in August 2025 and it launched in March 2026. You built
it with AI coding tools, owning the architecture, code review and release.
Stack: Next.js, React, TypeScript, Supabase (PostgreSQL), Stripe Connect,
Vercel, PostHog and Resend. Your skills list names Claude Code and Codex.

This is the "AI fluency with receipts" story the postings ask for, so be
concrete.

1. **Before.** In August 2025, what existed: a design, a spreadsheet, nothing?
   What did you decide to build first, and what did you leave for later?
2. **Yours and the tools'.** In a normal week, what do the AI tools do and what
   do you do? Which tools, for what? Is there anything you never let them
   change without reading every line?
3. **The hard call.** The biggest architecture decision you made, and what you
   gave up for it. Where in the code could a mistake cost someone money, and
   what do you do differently there?
4. **Pushback.** A time AI-written code was wrong in a way that mattered, or
   your co-founder pushed back on how something was built. How was it caught,
   and what did you change afterward?
5. **What changed, and how you know.** How do you know the code is good: tests,
   reviews, audits, incidents? Do you keep a record of bugs and what caused
   them? What would you show someone who asked for receipts?
6. **Differently.** What would you change?

**One breath:** "I'm the only developer on a live marketplace. The AI tools
______, and I ______."

```
5. Building A Darle 20 with AI tools
5.1 Before: ______
5.2 Yours and the tools': ______
5.3 Hard call: ______
5.4 Pushback: ______
5.5 What changed, and how I know: ______
5.6 Differently: ______
One breath: ______
Numbers, each with where it comes from: ______
Corrections to the record: ______
Private, never publish: ______
```

---

## 6. North America review app · 6 min

**Already on record:** you inherited the Power App and automations North
America runs its reviews on from a developer who moved teams, and you've
extended them. North America runs its monthly reviews, incentive performance
reviews and weekly operating review on it. About 30 core users: North America
sales ops and some sales leaders.

1. **Before.** What state was it in when you got it: documentation, a handover,
   known problems? How long between the developer leaving and you owning it?
2. **Yours and others'.** Who asks you for changes, and who decides which ones
   you make? How do you choose between those requests and the rest of your
   work?
3. **The hard call.** What did you rewrite, and what did you leave alone even
   though you'd have built it differently? What did you add?
4. **Pushback.** Did a change of yours ever break a review or upset its users?
   What happened?
5. **What changed, and how you know.** Is it healthier than when you got it?
   What tells you so: fewer breaks, faster changes, new uses?
6. **Differently.** What would you change?

**One breath:** "I inherited the app North America runs its reviews on.
______."

```
6. North America review app
6.1 Before: ______
6.2 Yours and others': ______
6.3 Hard call: ______
6.4 Pushback: ______
6.5 What changed, and how I know: ______
6.6 Differently: ______
One breath: ______
Numbers, each with where it comes from: ______
Corrections to the record: ______
Private, never publish: ______
```

---

## 7. A Darle 20's funnel and growth decision · 6 min

**Already on record:** you instrumented the funnel: conversion, refunds and host
activation. The data showed paid acquisition wasn't worth it, so growth runs on
in-person marketing and word of mouth. Revenue, GMV, MRR, cash payments and
visitor counts stay off the record.

1. **Before.** What did you believe about growth before you had numbers? Was
   paid acquisition tested for marketplace sessions, for events, or both, and
   for how long? Is "wasn't worth it" still true for all of them?
2. **Yours and others'.** Who set up the tracking, who read it, and who made
   the call on paid acquisition: you, your co-founder, both?
3. **The hard call.** What comparison decided it? A ratio or a before-and-after
   is enough; no money figures needed. And where did the funnel actually lose
   people: was it where you expected?
4. **Pushback.** Did anyone want to keep paying for ads? Has the decision been
   revisited?
5. **What changed, and how you know.** What does growing on in-person marketing
   and word of mouth look like week to week? How do you know where players come
   from? Have your analytics and your database ever disagreed about a count, or
   has a number raised an alarm that turned out to be a counting problem? Which
   did you trust, and why?
6. **Differently.** What would you change?

**One breath:** "I tracked every step from visit to reservation. It showed
______, so ______."

```
7. A Darle 20's funnel and growth decision
7.1 Before: ______
7.2 Yours and others': ______
7.3 Hard call: ______
7.4 Pushback: ______
7.5 What changed, and how I know: ______
7.6 Differently: ______
One breath: ______
Numbers, each with where it comes from: ______
Corrections to the record: ______
Private, never publish: ______
```

---

## 8. CRM Analytics to Power BI · 6 min

**Already on record:** you delivered Salesforce CRM Analytics dashboards for
exec reviews, with 150+ monthly users, then moved reporting to Power BI. You
also built Power BI reports for 5 teams outside the sales organization and
maintain the automation that keeps them refreshed. Your Salesforce work is CRM
Analytics reports and dashboards, not administration.

1. **Before.** Why move off CRM Analytics, and whose decision was it?
2. **Yours and others'.** What did "moved reporting" involve: rebuilding
   dashboards, the data model, the refresh? Who designed the data model?
3. **The hard call.** What did you drop or change in the move? How did you make
   sure the old and new numbers matched?
4. **Pushback.** Did the 150+ users follow? Who held on to the old dashboards,
   and what happened?
5. **What changed, and how you know.** What's different for the users, and for
   you? (150+ is the CRM Analytics figure. Give a Power BI number only if you
   can back it up.) How did the 5 outside teams find you, and how do you decide
   which of their requests to take?
6. **Differently.** What would you change?

**One breath:** "I moved exec reporting from CRM Analytics to Power BI because
______. ______."

```
8. CRM Analytics to Power BI
8.1 Before: ______
8.2 Yours and others': ______
8.3 Hard call: ______
8.4 Pushback: ______
8.5 What changed, and how I know: ______
8.6 Differently: ______
One breath: ______
Numbers, each with where it comes from: ______
Corrections to the record: ______
Private, never publish: ______
```

---

## 9. The convention event · 6 min

**Already on record:** you ran the technology behind a flagship 251-player event
at a 19,000-attendee convention, rated 4.96/5 by attendees. The record says you
ran the technology, not the event.

1. **Before.** What did the event need that the platform didn't do yet? How
   much lead time did you have?
2. **Yours and others'.** "The technology behind it" means what, exactly:
   reservations, table assignments, check-in, payments, an event page, support
   on the day? Who ran the event itself?
3. **The hard call.** What did you decide not to build, or to handle by hand on
   the day?
4. **Pushback.** What broke or nearly broke on the day, and what did you do?
5. **What changed, and how you know.** How was the 4.96/5 collected: what
   question, how many responses, who ran it? Did anything built for the event
   stay in the product for later ones?
6. **Differently.** What would you change?

**One breath:** "251 players at a 19,000-person convention. I ______."

```
9. The convention event
9.1 Before: ______
9.2 Yours and others': ______
9.3 Hard call: ______
9.4 Pushback: ______
9.5 What changed, and how I know: ______
9.6 Differently: ______
One breath: ______
Numbers, each with where it comes from: ______
Corrections to the record: ______
Private, never publish: ______
```

---

## 10. Utilization analysis · 4 min

**Already on record:** you led a lab and facility utilization analysis that
identified $1.2M in real-estate cost savings. Identified, not necessarily
realized.

1. **Before.** Who asked for it, and what were they trying to decide?
2. **Yours and others'.** "Led": who else worked on it, and what did you do
   yourself (the data, the method, the recommendation)?
3. **The hard call.** What data measured utilization, and what was the
   shakiest assumption? How did you get from utilization to a dollar figure?
4. **Pushback.** Did lab or facility owners dispute the findings?
5. **What changed, and how you know.** What happened to the recommendation?
   "I don't know" and "nothing yet" are fine answers.

**One breath:** "I measured how labs and facilities were used and found
______."

```
10. Utilization analysis
10.1 Before: ______
10.2 Yours and others': ______
10.3 Hard call: ______
10.4 Pushback: ______
10.5 What changed, and how I know: ______
One breath: ______
Numbers, each with where it comes from: ______
Corrections to the record: ______
Private, never publish: ______
```

---

## 11. AI agent in testing · 4 min

**Already on record:** you're building an AI agent on Power BI, Glean and Teams
that flags pipeline gaps against prior years, conflicting fields and past-due
dates. Power BI does the bulk analysis and segmentation; Glean is the reasoning
layer. It's in testing, not live, and has no results yet. Plans beyond testing
are off the record.

1. **Before.** What made you start it? What do people do today to find these
   gaps?
2. **Yours and others'.** Whose idea was it, who's testing it, and who would use
   it?
3. **The hard call.** Why split the work between Power BI and Glean? What did
   you try first that didn't work?
4. **Pushback.** What concerns have come up: data access, trust in what it
   flags, false alarms? How are you handling them?
5. **How you'll know.** What does "it works" mean in testing, and how will you
   measure it?

**One breath:** "I'm building an agent that ______. It's in testing."

```
11. AI agent in testing
11.1 Before: ______
11.2 Yours and others': ______
11.3 Hard call: ______
11.4 Pushback: ______
11.5 How I'll know: ______
One breath: ______
Corrections to the record: ______
Private, never publish: ______
```

---

## 12. Gap prompts · 8 min

A recruiter for these roles will look for three things your record doesn't
show: Salesforce administration, CPQ or deal desk, and professional services
work (PSA tools, SOWs, billable utilization). The site doesn't paper over them,
and the chat names them when a posting asks.

These questions look for adjacent experience. **"None" is a complete answer to
every one**, and if it's true it's the most useful one: it confirms what the
chat already says. Adjacent work only ever gets said as what it is, never as
the thing itself.

**Salesforce administration**

- G1. The record says your Salesforce work is CRM Analytics reports and
  dashboards, not administration: no flows, validation rules or data loads. Is
  that still exactly right?
- G2. When a dashboard needed data Salesforce didn't capture, what happened? Who
  changed Salesforce, and was your part the request, the spec, the testing, or
  nothing?
- G3. Have you built anything in a Salesforce org outside Nokia, such as a
  practice org, a course or a client?

**CPQ and deal desk**

- G4. Have you worked with quotes, discount approvals, pricing rules or
  contract terms, as a builder, a reporter or a user?
- G5. Do any of your Nokia reports or tools draw on order, quote or contract
  data? If so, which, and what did you do with it?
- G6. At A Darle 20, did you design pricing, fee or refund rules in the
  product? Describe the logic, not the money.

**Professional services: PSA, SOWs, utilization**

- G7. Have you used a PSA or resource management tool, or tracked time against
  projects?
- G8. Have you scoped work, written a statement of work, or tracked hours
  against a budget, in any job, freelance included? Describe how, not how much.
- G9. Did the headcount forecast match people to work (capacity, demand,
  skills), or count heads against budget? Either answer is useful.
- G10. In the lab and facility analysis, what was being utilized, and how was it
  measured? The record treats it as real-estate utilization, which is not
  billable utilization, and the chat keeps the two apart.
- G11. Have you worked on or alongside a professional services, delivery or
  implementation team?

**Two more the record is silent on**

- G12. Where have you written SQL for work, and against what data? "A Darle 20
  only" is a fine answer.
- G13. Have you managed anyone: direct reports, interns, contractors?

```
Gap prompts
G1: ______
G2: ______
G3: ______
G4: ______
G5: ______
G6: ______
G7: ______
G8: ______
G9: ______
G10: ______
G11: ______
G12: ______
G13: ______
Private, never publish: ______
```

---

## 13. Why these roles · 2 min

Not a story, but it's one of the first questions in any screen. Your reasons
aren't on record, so the chat answers "why delivery operations?" with what your
record shows fits and never with a motive. One or two plain sentences of your
own would let it answer directly.

- W1. Why RevOps and delivery operations, in your words?
- W2. What do you want to do more of in the next role?

```
Why these roles
W1: ______
W2: ______
```

---

## Which story answers which question

Seventeen questions these interviews actually ask, and the story that would
answer each once you've told it. Numbers in brackets point at the question
whose answer carries it.

- **Ready:** the record already has the skeleton; the interview adds the story.
- **Depends:** a story might answer it, depending on what you say.
- **Nothing yet:** no story in the record can answer it.

| Question | Answer with | Backup | Status |
| --- | --- | --- | --- |
| Tell me about a time you drove adoption of a tool. | 1 Quarter-end close app | 2, 8 | Ready |
| Walk me through a process you replaced or automated end to end. | 1 Quarter-end close app | 3, 4 | Ready |
| Tell me about a time you had to deliver fast. | 2 Weekly review (two weeks) | 9 | Ready |
| Tell me about a time you inherited a mess. | 6 North America app | 3 | Ready |
| How do you use AI in your work? | 5 Building A Darle 20 | 11 | Ready |
| Tell me about a decision you made from data. | 7 Growth decision | 10 | Ready |
| How do you make sure a number means the same thing to everyone? | 2 Weekly review (2.3) | 1 (1.3), 8 (8.3) | Ready |
| Tell me about a launch you owned from discovery through adoption. | 1 Quarter-end close app | 9 | Depends on 1.1: who asked |
| Tell me about a forecast you ran. How good was it? | 4 Headcount forecast | — | Depends on 4.5: accuracy isn't on record |
| Tell me about a time the data was wrong in front of executives. | 3 or 1 | 7 (7.5) | Depends: the record has no incident, so only if one happened |
| How do you prioritise competing requests? | 6 North America app (6.2) | 8 (8.5) | Depends on 6.2 and 8.5 |
| How do you change how people work without authority over them? | 2 Weekly review (2.4) | 3, 4 | Depends on 2.4 and 4.2 |
| Tell me about a time you pushed back on a stakeholder. | Whichever pushback answer is strongest | — | Nothing yet: the record has no "advisor, not order-taker" moment |
| Tell me about a failure. | Any "differently" answer | 7, 11 | Nothing yet |
| Why delivery operations? Why RevOps? | 13 Why these roles | — | Nothing yet: not a story |
| Have you configured Salesforce, CPQ or a PSA tool? | 12 Gap prompts | — | Nothing yet: a gap, answered honestly |
| Tell me about managing a team. | G13 | — | Nothing yet |

---

## The answer template

For the agent that ingests the answers. This is the shape of a future
`content/knowledge/stories.md`. **Don't create that file until there are answers
to put in it,** and never with placeholders: the template lives only here.

```markdown
# Stories

Sidhant's own accounts of his main projects, from an interview on ______.

## Quarter-end close app

- In short: ______
- Before: ______
- What he did: ______
- The hard call: ______
- Pushback: ______
- What changed: ______
- What he'd change: ______

## Weekly operating review tool

- In short: ______
- Before: ______
```

**From the paste-back to the template:** "One breath" becomes "In short" (third
person, with the employer, tool and scale named). x.1 becomes "Before"; x.2
becomes "What he did", including who else did what; x.3 "The hard call"; x.4
"Pushback"; x.5 "What changed", including how he knows; x.6 "What he'd change".
Numbers come only from each story's numbers line. A bullet with no answer is
left out, and a story with no answers is left out entirely.

**Headings are ids.** Each `##` becomes the chunk `stories:<heading as a slug>`,
which the model cites and the panel opens. Keep them short, and don't rename
them once published (`evals/citations.test.mjs` guards the ids the shell
hardcodes).

| Story | Heading | Chunk id |
| --- | --- | --- |
| 1 | Quarter-end close app | `stories:quarter-end-close-app` |
| 2 | Weekly operating review tool | `stories:weekly-operating-review-tool` |
| 3 | Sales incentive calculations | `stories:sales-incentive-calculations` |
| 4 | Headcount forecast | `stories:headcount-forecast` |
| 5 | Building A Darle 20 with AI tools | `stories:building-a-darle-20-with-ai-tools` |
| 6 | North America review app | `stories:north-america-review-app` |
| 7 | A Darle 20 growth decision | `stories:a-darle-20-growth-decision` |
| 8 | CRM Analytics to Power BI | `stories:crm-analytics-to-power-bi` |
| 9 | Convention event | `stories:convention-event` |
| 10 | Utilization analysis | `stories:utilization-analysis` |
| 11 | AI agent in testing | `stories:ai-agent-in-testing` |

**Why this shape.** Each rule below was checked on 2026-11-02 by running a copy
of `scripts/build-knowledge.mjs` on a throwaway file outside `content/`, and
the citation rule against `lib/verify.ts`:

- **One `##` per story, bullets only.** A section with a prose paragraph and
  bullets keeps only the bullets. The paragraph is dropped without a warning.
- **Indent wrapped lines two spaces.** A bullet's continuation line that isn't
  indented is dropped without a warning.
- **No `###` inside a story.** A `###` splits the section into separate
  chunks, drops the text above it, and gives each block an id from its own
  heading, so two stories with a "### Before" fail the build on a duplicate id.
- **Plain labels, no bold.** `**Before:**` reaches the prompt as literal
  asterisks.
- **"In short" names the employer or product, the tool and the scale.** The
  checker looks for every number and proper noun of a cited sentence in the
  chunk it cites. A sentence about the Nokia Power App for 80+ stakeholders
  across 7 regions verified against a story chunk that carried that context,
  and came back miscited against the same story without it.
- **Digits, written the way the rest of the record writes them:** "7 regions",
  "80+", "900+". The corpus saying "seven" while answers said "7" marked correct
  answers miscited once already (`docs/gauntlet-log.md`, round 3).
- **Third person.** The chat talks about him, never as him; the rest of the
  corpus says "he". First person belongs in the case studies.
- **No `[TODO` or `[VERIFY`.** One marker holds the whole story out of the
  chat, not just its line. A detail he isn't sure of is cut, not marked.
- **About 600 characters a story, roughly 90 to 100 words.** On 2026-11-02 the
  assembled system prompt was about 7,790 tokens against the 10,000-token
  ceiling in `evals/static.test.mjs` (the knowledge base alone was about 3,610
  of its 8,000), which leaves roughly 8,800 characters for every story,
  headings included. Other work may have used some of that since: measure
  first. The longer version of a story goes in a case study, which costs the
  prompt nothing.

---

## After the interview

A checklist for whichever agent ingests the paste-back.

**Before writing anything**

- [ ] Read the paste-back against this guide. A number marked "not sure", and
      anything marked private, goes nowhere.
- [ ] Keep the raw answers out of git: the repo is public. Work from the paste
      in the session, or save it under `docs/source/`, which git ignores.
- [ ] Check every answer against what's already on record: the exact shapes in
      `lib/system-prompt.ts` ("Saying it the way the record says it" and "What
      the record leaves out"), and section 5 of the decisions log in
      `docs/source/` if this machine has it. An off-the-record item without an
      explicit "override" goes nowhere. A conflict with the record is a
      question for Sidhant, never a choice you make.
- [ ] Ask Sidhant once, if it isn't settled yet: since the 2026-10-26 resume
      sync, detail beyond the resume comes only from the decisions log's
      section 4. Does the interview count as a source in its own right, or do
      its facts go into the decisions log first?

**Where each answer goes**

| Answer | Goes to | Notes |
| --- | --- | --- |
| A story's six answers and its one-breath line | `content/knowledge/stories.md`, one `##` per story | The template above: third person, condensed, about 600 characters |
| A story worth a section on a project page | `content/nokia.mdx` or `content/adarle20.mdx`, and the same text in `docs/site-copy.md` | First person. Add `content/knowledge/stories.md` to that page's `SOURCES` in `evals/track-b.test.mjs`, or every new paragraph fails it |
| A correction to a fact on record | The knowledge file that holds the fact (`projects-*.md`, `faq.md`, `bio.md`) | `resume.md` changes only when the master resume does: it mirrors the master, and `evals/resume.test.mjs` holds `/resume` to it |
| Adjacent experience from the gap prompts | `faq.md`, under "What does he bring to delivery operations?" or a new question | Worded as what it is, never as the gap ("scoped freelance projects", not "SOW experience") |
| "None" from a gap prompt | Nowhere | The prompt already says the record doesn't show it; the answer confirms that |
| Why these roles (W1, W2) | `faq.md`, "What roles is he targeting?" | Then drop the "His reasons for wanting any of these roles are not on record" sentence in `lib/system-prompt.ts` |
| An "override" of an off-record item | Wherever the fact belongs | Remove its line from "What the record leaves out" in `lib/system-prompt.ts` in the same commit |

**Writing**

- [ ] Create `content/knowledge/stories.md` from the template with only the
      stories that have answers.
- [ ] Register it in `FILES` in `scripts/build-knowledge.mjs`:
      `{ file: "stories.md", source: "stories", label: "Stories" }`. Appending
      it last leaves every existing chunk where it is. The `/sources` panel
      groups by label, so a "Stories" group appears on its own.
- [ ] Log every chunk and case-study paragraph in `docs/copy-ledger.md`, in a
      new section ("Interview answers, <date>"): status `draft` for anything
      condensed or reworded (`sidhant` only for his words verbatim), Claims
      `factual`, Source "interview, <date>".
- [ ] Show Sidhant the condensed stories before they ship. Condensing is where
      a fact gets inflated.

**Checking**

- [ ] `node scripts/build-knowledge.mjs`: the `stories:` ids are listed, and
      nothing is "held back" that shouldn't be.
- [ ] `npm run eval`: the knowledge base stays under 8,000 tokens and the
      assembled prompt under 10,000. Over budget, shorten the stories. Raising
      the ceiling raises the cost of every chat turn, so that's Sidhant's call.
- [ ] Add two or three `GROUNDED` cases in `evals/cases.mjs` for behavioural
      questions from the map above ("Tell me about a time he drove adoption of
      a tool"), each expecting a fact only the story holds.
- [ ] `npm run build` (the postbuild marker check runs with it) and `npm run
      lint`, zero errors.
- [ ] Republish the measurements, since the corpus changed. This needs
      `AI_GATEWAY_API_KEY`, so it doesn't run in a cloud sandbox:
      `npm run eval:live -- --group grounded`, then `npm run eval:publish`, then
      commit `evals/published/latest.json`.
- [ ] On the Vercel preview, ask the chat three questions from the map. Each
      answer should cite a `stories:` id and show no unverified marks.
- [ ] Update the map in this file: move anything the interview answered to
      "Ready", and note what's still "Nothing yet".
