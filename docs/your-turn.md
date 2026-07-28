# Your turn

The site is built. What's left is the part no agent can do: the facts only you
know, and the files only you can capture.

This is the whole list, in order. Everything above the line marked **"sendable"**
has to happen before you send the link to anyone. Everything below it makes the
site better but doesn't block.

**How to use this:** work top to bottom. Each item says what it's for, roughly how
long it takes, and exactly where to type. Blanks look like `______`. Where I have
a suggestion I've written it under **Ideas** — those are prompts to react to, not
drafts to approve. Anything you leave blank stays visibly blank on the site; that's
by design, and it's better than a guess.

Total: about half a day, most of it capturing screens.

---

## 1. Two sentences only you can write · 10 min

### 1a. What are you *not* looking for?

**File:** `content/knowledge/faq.md`, under "What is he not looking for?"
**Replace:** `[TODO: Sidhant — stated nowhere; do not guess]`

The site already tells a recruiter what you want (RevOps / GTM systems at an
AI-forward company). It has nothing for the other half, so when someone asks, the
chatbot has to say it doesn't know — right after confidently answering everything
else. It's the most visible hole in the corpus.

```
What is he not looking for?

______
```

**Ideas** — pick whichever are true, one line each, plainly:
- A role type you'd turn down (pure support? pure sales quota? IC-only with no systems ownership?)
- A company stage that isn't a fit (pre-product? 5,000-person enterprise?)
- Location or work-mode limits beyond what's already in the FAQ
- Tooling or environment you don't want to go back to

Keep it short and non-defensive. Two or three lines is plenty. This makes you look
*more* hireable, not less — a candidate who knows what they don't want reads as
someone who's chosen the thing they do want.

### 1b. Is the A Darle 20 repo public?

**File:** `docs/site-copy.md` line 378 — `[TODO: confirm repo is public before linking]`

Just answer: **yes / no**. If yes, I'll wire the link. If no, I'll cut the sentence.
Nothing else depends on this.

---

## 2. The features nobody wrote down · 15 min

Your words: *"there's a shit ton of features buried up there."* The site can only
list what's written in the record, so right now the A Darle 20 page publishes
twelve capabilities and then says out loud that the list is incomplete.

**This is the highest-value 15 minutes on the list.** Everything you add here shows
up in three places at once: the feature list on the project page, the chatbot's
answers, and the citations that back them.

**File:** `content/knowledge/projects-adarle20.md`

Already in the record — don't re-write these:

> host profiles · session listings · bookings and reservations · cancellations ·
> automated refunds · Stripe Connect · host payouts · platform fees · OXXO cash
> payments · real-time chat · transactional email · authentication · funnel
> instrumentation

Add a section at the end and list what's missing. One line each — a name and a
sentence is enough for it to be quotable and citable:

```markdown
## Also in the product

- ______ — ______
- ______ — ______
- ______ — ______
```

**Ideas** — things a two-sided marketplace usually has that aren't on the list
above, as prompts. Only write the ones that actually exist:
- Reviews and ratings *(visible in the one screenshot the repo has — but a
  screenshot isn't the record, so it still can't be claimed until you write it here)*
- Search, filters, or discovery beyond the listings page
- Waitlists, recurring sessions, or seat management
- Host onboarding, verification, or activation flow
- Admin or moderation tooling
- Notifications beyond email
- Anything localisation- or Spanish-specific
- Anything you built for the 251-player event that doesn't exist elsewhere

---

## 3. Capture six screens · 2–3 hours, and this is the big one

The A Darle 20 page currently has **one** image. Six frames sit empty, each
labelled with what belongs in it. The 251-player event — the single most impressive
thing you've done — has never been visible on this site.

Use a **test account** for anything with a name or email in it.

| # | Save the file as | What it needs to show | Shape |
| --- | --- | --- | --- |
| 1 | `public/images/adarle20-booking.mp4` | **Screen recording.** One unbroken take: listing page → checkout → confirmation. No cuts. | 16:9 |
| 2 | `public/images/adarle20-cash.png` | The OXXO path at the moment the player gets the payment reference to take to the store. Nobody outside Mexico has seen this. | 9:16 (phone) |
| 3 | `public/images/adarle20-host.png` | A host's own view — their profile, upcoming sessions, payouts. | 16:9 |
| 4 | `public/images/adarle20-chat.png` | A real-looking thread in the in-app chat, long enough that it clearly isn't a contact form. Redact or use test accounts. | 9:16 (phone) |
| 5 | `public/images/adarle20-funnel.png` | Whatever you actually look at to run the business. **Check this one before sending — the numbers in it get published.** | 16:9 |
| 6 | `public/images/adarle20-convention.mp4` *(or `.jpg`)* | Footage or photos from the 251-player event at the convention. | 16:9 |

**Then, for each file you captured**, open `content/adarle20-media.ts`, find the
matching slot, and add an `asset` block after `width:`:

```ts
    asset: {
      src: "/images/adarle20-host.png",
      alt: "______",       // describe what's in the image, factually
      caption: "______",   // one line shown under it
    },
```

Or just drop the files in `public/images/` and tell me — I'll wire them up and
write the alt text from what's actually in each file.

**If you only do one:** number 6. A photograph of 251 people in a room is worth
more to a hiring manager than any paragraph on the site.

---

## 4. Record one walkthrough · 1 hour

This is the argument for video, and it's narrow. The site is very good at proving
you can build. It cannot prove you can *explain* — and RevOps / GTM is a
talk-to-people job. A two-minute recording of you narrating your own product is the
one artifact the chatbot can't substitute for.

**Format:** 2–3 minutes, Loom or similar, screen share with your face in the corner,
one take, conversational. Not scripted, not edited, no intro card. It doubles as
item 3's booking recording if you narrate while you do it.

**Beats to hit** — fill these in before you hit record, then talk, don't read:

1. **What it is, in one sentence, to someone who's never played a tabletop game.**
   `______`
2. **The problem in the market.** Why booking a game master was broken before.
   `______`
3. **Drive the booking flow.** Listing → checkout → confirmation, talking through it.
4. **The one thing you'd point at as hard.** The part a generic marketplace tutorial
   wouldn't have taught you — cash payments, refunds, payout edge cases, whichever
   is truest.
   `______`
5. **Where it stands.** The numbers are already public on the site, so just say them.
6. **Stop.** Don't sell, don't sign off with a pitch. End on the product.

**Don't** record a "hi, I'm Sidhant" intro video. A stiff monologue to camera costs
more than it earns; a person explaining their own work does the same job better.

---

## 5. Republish the measurements · 10 min

`/measurements` is currently publishing **10 of 30 claims verified** from an old
run. A later run scored far better and was never published — so right now the page
that exists to prove the site is honest is under-selling it.

Needs `AI_GATEWAY_API_KEY` in `.env.local`. Costs a few cents.

```bash
npm run eval:live -- --group grounded
```

```bash
npm run eval:publish
```

Then commit `evals/published/latest.json`. Re-run and republish whenever the corpus
changes — including after item 2 above.

---

## 6. Turn on the analytics · 5 min

The latency and reliability panel has only ever rendered its empty state, because
PostHog has zero production events. Three variables, set in Vercel:

- `POSTHOG_PROJECT_ID` — the numeric project id
- `POSTHOG_PERSONAL_API_KEY` — a personal API key with query scope
- `POSTHOG_HOST` — only if you're not on `https://us.posthog.com`

The panel fills in at the next build. Until then it honestly says it has no data,
which is fine but is a wasted surface.

---

### ─── sendable ───

Everything above this line is what stands between the current site and a link you'd
send to a hiring manager. Everything below improves it.

---

## 7. Skim the drafted copy · 30 min

55 strings on the site were drafted by me rather than written by you, all logged in
`docs/copy-ledger.md`.

**Good news, and it changes what this pass is:** every one of them is marked
`none` in the Claims column — not a single drafted string asserts a checkable fact
about your experience. The facts on the site all come from `content/knowledge/` and
the resume. So this is a **voice check, not a fact check.** Read for "would I say
it like that," not for "is this true."

Read the "What it says" column top to bottom. For each row: leave it, or tell me
what's wrong with it. I'll change the status to `approved` or rewrite.

## 8. Send it somewhere · ongoing

The site is built to be found. Nothing currently points at it.

- **Use the JD flow yourself.** For each application, paste the job description into
  your own site, export the scorecard PDF, and send it with the application. That's
  the feature working outbound instead of waiting inbound.
- **Write the post.** How you built a chatbot that can't lie about you — the citation
  enforcement, the eval suite, the multi-agent workflow. It's the most distinctive
  thing you've made, and right now only people who already found the site ever see
  it.

---

## When you're done

```bash
npm run build
```

Zero errors, then commit. If you'd rather hand me raw material — files, bullet
points, a voice note — drop it in and I'll wire it up; the two things I can't do
are invent facts about you and hold a camera.
