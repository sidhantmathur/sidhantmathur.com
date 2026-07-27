# Manual test plan — desktop and phone

Assembled 2026-07-27, covering Sprints 5, 6 and 7 and Track B. Everything here
is deployed to https://sidhantmathur.com.

This is the list of things **no test could check for itself**. The static suite
is at 266 assertions and covers logic, shapes, copy-to-corpus agreement and
overflow at 390 px. What it cannot do is look at paper coming out of a printer,
judge whether an animation is too much, or press a button on a real iPhone.

**Before you start:**
- A conversation persists in your browser. `reset` in the actions strip clears it.
- Failure states are reproducible on demand: add `?simulate=<class>` to the URL.
  They call no model and cost nothing.
- The message limit is 20/hour per IP. Tests 1–6 will use a few.

**If you only have twenty minutes**, do §A: those are the four things most likely
to be wrong and least likely to be caught later.

---

## §A — The high-value four

### A1. Print something (desktop)
Have a conversation → `export` → **print / save as PDF**. Also just press Cmd-P.

**Correct:** the *document* prints, never the app. Dark theme gone, black text on
white, ~18 mm margins, and a question never splits from its answer across a page
break.

**Why it's first:** CI cannot check paper. The first implementation of this
nested the document inside the element that print hides — every print would have
come out blank and nothing on screen would have shown it. There's a structural
test now, but it can still regress silently.

### A2. Print a job-description assessment (desktop)
Paste a real posting, wait for the assessment, then print.

**Correct:** the requirement table with verdict tags, the cited ids under each
row, every gap, and the "not a score" sentence — all present on paper.

### A3. Copy a link on a real iPhone (phone)
Have a conversation → `export` → **build a link** → **copy the link**.

**Correct:** "link copied" appears.

**Why it matters:** iOS Safari requires a clipboard write to happen inside a user
gesture, and this path compresses the conversation *asynchronously first*. If it
silently fails, the fallback opens the export panel instead. **Check which one
you get** — this is the single path that could not be tested on real hardware.

### A4. Mail yourself a long permalink (desktop)
Paste a 3,000+ character posting, get an assessment, build a link — then actually
email it to yourself and open it.

**Correct:** the character count is shown; over 2,000 an accent-coloured
"past the length some mail clients cut" warning appears. The mailed link still
works when clicked.

**Why:** the size estimate in the design doc was right for ordinary transcripts
and wrong for posting-plus-assessment. Whether it survives a real mail client is
a measurement nobody has taken.

---

## §B — Desktop

### The new pages
1. **`/measurements`** — read top to bottom. Correct: four figures under "The
   eval suite", a collapsed list of test files, one live-run row, an **empty**
   latency section, and a groundedness figure that is an em dash with "too few to
   report" under it. **No section should show a percentage.**
2. **The `<details>` rows on `/measurements`** — expand each. Correct: per-suite
   counts and full assertion names; they open and close independently; the page
   doesn't jump. *This is the only interaction on the page and it was never
   clicked by anything.*
3. **Do the em dashes read as a refusal or as a bug?** `—` with "too few to
   report" beneath is deliberate. If it reads as broken rendering, the label
   needs rewording — that's a real finding, not a nitpick.
4. **`/prompt`** — the whole prompt in two `<pre>` blocks with character counts in
   the headings. Correct: the first starts "You are the assistant embedded…" and
   contains a `## This site` section; the second starts `---SITE-SOURCE---`. **An
   empty block means the page lost its binding to the live prompt.**
5. **`/refusals`** — eleven entries, each with a right-aligned label. Correct:
   five "enforced by code", five "asked of the model", one "a decision, not a
   mechanism".
6. **`/colophon`** → the "See the measurements" link works. **`/sitemap.xml`**
   lists `/measurements`, `/prompt`, `/refusals`.

### The chat
7. **Ask "how is this site built?"** Correct: an answer citing `repo:` ids, with
   those ids in the left margin and as chips beneath. Clicking one opens the repo
   corpus in the panel with that chunk highlighted. **Also open the trace**
   (status strip → Trace → expand the turn): it should read `corpus knowledge +
   repo`, and input tokens should be ~4,000 higher than an ordinary turn.
8. **Type `/roast`.** Read it for two things: that it says nothing about *you*,
   and that no file path renders as a clickable link (paths should be code-styled).
   Then decide whether you like it — see the copy review, §4.2.
9. **`/prompt`, `/refusals`, `/sources`, `/budget`, `/pdf`, `/jd`, `/fit`** as
   slash commands — each opens a real panel beside the conversation.
10. **`?simulate=rate_limited`, then ask anything.** Correct: manual mode replaces
    the error — your rate-limit line, then the FAQ answers verbatim with their
    `faq:` ids, then the link row. **The "What is he not looking for?" entry must
    NOT appear** (it still holds a TODO).
11. **Post-action emphasis** — copy something, or open a citation. The strip's
    labels and top border lift for ~6 seconds, then settle. **A taste call: is
    that the right amount of weight?** It's deliberately subtle.

### Export and permalinks
12. **`download .md`** — a `conversation.md` with title, source URL, the permalink
    if you built one, and the footer disclaimer.
13. **Mail draft** from a scorecard — opens your client with plain-text, no `**`
    markdown artifacts, every gap present.
14. **Open a permalink in a private window.** Correct: banner at the top, the
    conversation replayed, and your own stored conversation in the original
    browser untouched.
15. **Open a citation while reading a permalink, then reload.** Correct: the URL
    keeps `#c=…` and the reload replays. *This was a real bug; worth confirming.*
16. **"start a fresh one"** — clears the conversation, drops the fragment from the
    address bar, and a reload gives the ordinary empty state.

### The homepage (Track B)
17. **`/`** — hero, then a left-ruled `tl;dr` block with six label/value rows,
    then four chips, then the disclaimer. All above the fold at 1440×900.
18. **Ask anything** — the TL;DR should **disappear** once a message exists, and
    not come back until reset.
19. **`/projects/adarle20`** — below the case study: "Everything in it" (feature
    grid), then "What it looks like" — one real screenshot and six **dashed**
    empty frames with briefs inside. Correct: dashed outlines, not grey filled
    blocks; a filled block would read as a broken image.
20. **`/projects/nokia`** and **`/projects/dell-ml`** — each opens with "In plain
    terms" before "The problem".

### The bug I fixed — please confirm it's actually gone
21. If you have a browser that used this site **before today**, open it and check
    you get your old conversation or a clean empty state — **not a blank page**.
    A conversation saved before the assessment shape changed used to crash the
    entire shell on load, with no way out but clearing storage. If you see a
    blank page, tell me: that's the bug, not a new one.

---

## §C — Phone

Everything below was checked for overflow at 390 px programmatically and passed.
What's left is judgment, touch, and iOS-specific behaviour.

22. **The 44 px question — this recurs three times and it's one decision.**
    Tap targets are under Apple's 44 px guidance in three places:
    - the actions strip buttons — **32 px**
    - the `<details>` summaries on `/measurements` — **~26 px**
    - the header, which made the same trade last sprint

    They're consistent with each other and with the site's density. **Your call,
    once, for all three.** Try them with a thumb rather than measuring.
23. **The actions strip at 375–430 px** — fits exactly at 390 px and scrolls
    horizontally below that. Correct: the input row above never moves; the strip
    never wraps to two lines.
24. **Export as a bottom sheet** — tap `export`. Correct: opens at 52 dvh,
    "expand ↑" gives 88 dvh, the link text wraps rather than overflowing, and the
    link is selectable if the clipboard write fails.
25. **Print from a phone** (share → print) — the document, not the app.
26. **Replay a permalink** — banner readable, and the panel does **not** auto-open
    over the conversation.
27. **`?simulate=rate_limited` → ask a question.** Manual mode is the longest
    thing that has ever appeared in the message column on a phone. It fits, but
    check where the scroll lands — you may want it at the headline rather than
    the bottom.
28. **`/roast` on a phone** — a long multi-paragraph answer with bold
    sub-headings. Does it read as a wall?
29. **`/measurements` at 390 px** — figures wrap; confirm the wrapping looks
    deliberate rather than stranded. The expanded assertion lists contain long
    sentences — confirm they wrap readably.
30. **`/projects/adarle20` at 390 px** — frames are 385×216 (16:9) and 300×533
    (9:16). The 16:9 briefs fill their frames almost exactly (214 of 216 px), so
    a longer brief will make the frame *grow* rather than clip. Worth knowing
    before anyone edits one.
31. **`/` on a phone** — the six TL;DR rows stack label-over-value and should all
    be visible without scrolling; chips wrap to 3–4 lines. The TL;DR sits inside
    the scroller, so the input row must stay pinned.
32. **Slash commands typed on a phone keyboard** — the popover appears above the
    input, not under the thumb.

---

## §D — Known, deliberate, not bugs

Don't spend time reporting these.

- **The latency section of `/measurements` is empty.** No analytics credentials
  at build time — and separately, the two events it needs have never once fired.
  See the copy review, §4.5.
- **Groundedness shows an em dash, not a percentage.** Under 20 published claims
  the page refuses to print a rate. Working as designed.
- **The seismograph's live rate has a `≈` and the settled number doesn't.** One
  is an estimate sampled from the text, the other is the provider's own count.
  The distinction is the point.
- **A replayed conversation isn't saved**, even after you continue it. That's to
  protect your own stored conversation. A reload mid-continuation loses the new
  turns — a real surprise, judged the right trade.
- **A replayed 10-turn conversation is already at the turn cap**, so the next
  question hits the graceful 429.
- **The assistant declines to recite its system prompt** even though `/prompt`
  publishes it in full. Deliberate, and `/refusals` explains why.
- **The A Darle 20 feature list looks short.** It's built strictly from the
  written record. See the copy review, §1.1 — the fix is the corpus.
- **Six empty dashed frames on the A Darle 20 page.** Waiting on assets from you.
