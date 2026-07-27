# Track B spec — project pages and recruiter copy

One page, written 2026-07-27 at the point of starting the track, per
`docs/roadmap.md` → "How the work gets specced". Intent and acceptance only; it
names no files or functions, because those move.

Covers **#19** (expand the A Darle 20 project page), **#20** (explain-like-I'm-
five as static build-time prose), **#25** (TL;DR for recruiters above the fold)
and **#26** (recruiter-tuned question chips).

---

## Intent

Track A built a site that answers well when someone asks. Track B is for the
visitor who has not asked yet — the recruiter with a stack of tabs open at
eleven at night, who will decide in six seconds whether this one is worth a
question.

Four pieces, all static, none of them touching what the model does:

- The homepage gives that reader the facts a resume would have given them, above
  the fold, before any turn is spent.
- The chips beside it become the questions that reader actually has, instead of
  the questions the site wanted to demo.
- The project pages explain themselves in plain language before they explain
  themselves in stack names, so a non-engineer can read the first screen.
- The A Darle 20 page gets the surface it has been missing: the feature list, and
  frames for the screenshots and recordings of a product that nobody reading this
  site has seen.

**The failure mode this track has to avoid is specific, and it is the opposite
of Track A's.** Sprint 6 could not invent a number because its sources were
empty; here the sources are a real person's career, the copy is recruiter-facing,
and recruiter-facing copy wants concrete numbers. Every metric, date, title, tool
and outcome comes out of `content/knowledge/` or the resume, or it is written as
`[VERIFY]` and left visibly unfinished. A plausible guess that survives review is
the one outcome this track cannot recover from — it puts a claim in Sidhant's
mouth that a hiring manager can check and he cannot defend.

The same rule applies to assets. **The A Darle 20 page must not describe a
screenshot or a recording that does not exist.** It builds the frames, says what
belongs in each one, and renders them visibly empty until a real file arrives.

## What ships

**#25 — the recruiter TL;DR.** A short, dense, labelled block in the homepage's
empty state, above the chips: what he does now, what he has shipped, what he is
looking for, and where he is. Every line traces to a source. It is scan-shaped —
labels and facts, not a paragraph — because the reader it is for is not reading
prose yet. It disappears once a conversation starts, because by then it has done
its job.

**#26 — recruiter-tuned chips.** The three existing suggested questions are
replaced, not added to. The new set is what a recruiter screening a candidate
actually asks in the first minute, including the boring screening questions the
site can answer instantly and a hiring manager would otherwise have to email for.

**#20 — plain-language explanations.** Each of the three case studies opens with
a section that explains the thing to someone with no context: what it is, who it
is for, and why it was harder than it sounds. Written once, at build time, into
the page — not generated per visit, and not a chat feature. The technical
sections stay exactly where they are underneath it; this is a layer on top, not a
rewrite.

**#19 — the A Darle 20 surface.** Two additions to that page. First, the feature
surface: the product's capabilities as a real list, so "there's a shit ton of
features buried up there" stops being invisible. Second, a media surface — named
slots for screenshots, a screen recording and a video, each declaring its aspect
ratio and what it must show, each rendering an honest empty frame until a file
exists. Filling one is dropping a file in and adding one line.

## Constraints

1. **No invented facts, and `[VERIFY]` is the only alternative.** Employers,
   dates, titles, metrics, tools, team sizes, dollar figures, user counts,
   feature names. If the corpus does not have it, the sentence ships with the
   hole visible and the hole is listed for Sidhant.
2. **Every drafted string is logged in `docs/copy-ledger.md`**, with whether it
   makes a factual claim, and the source column pointing at the corpus file the
   fact came from — not at "the resume" in general.
3. **`docs/site-copy.md` is the source of truth and gets the copy too.** Existing
   `[TODO]` markers there stay visible; none of them gets resolved by inventing
   content.
4. **No faked asset.** No placeholder image that could be mistaken for a
   screenshot, no caption describing footage nobody has seen, no `alt` text
   asserting what a missing image shows.
5. **Static-first.** Everything pre-renders. No new route beyond what exists, no
   client fetch, no runtime dependency on an asset being present.
6. **Sentence case everywhere**, per `CLAUDE.md`.
7. **The chips are a copy swap.** #26 touches the same files as Sprints 2, 5 and
   7. The diff there should be the strings and nothing else.
8. **A new chip must not trip a detector.** The job-posting and site-question
   detectors both read the visitor's text; a suggested question that false-
   positives either one would spend a forced tool call or a second corpus on a
   turn that wanted neither. Asserted, not assumed.

## Done means

- The homepage's empty state carries a recruiter TL;DR whose every line traces to
  `content/knowledge/` or the resume, and the suggested chips are the recruiter
  set.
- All three case studies open with a plain-language section, written at build
  time, above the existing technical sections.
- `/projects/adarle20` publishes the feature surface and a media surface whose
  every empty slot names what belongs in it, at what aspect ratio, and renders as
  a visibly empty frame rather than as content.
- Every string added is in `docs/copy-ledger.md` and in `docs/site-copy.md`.
- Every fact the corpus could not supply is marked `[VERIFY]` inline **and**
  listed in the ledger's pending-`[VERIFY]` table.
- `npm run build`, `npm run lint` and `npm run eval` clean, with the suite larger
  than the 232 it starts at and no existing assertion loosened.

## Out of scope, deliberately

- **Producing the assets.** Recording, capturing, editing or sourcing anything
  for #19. The frames ship; the files are Sidhant's.
- **Video infrastructure.** No player library, no transcoding, no CDN, no
  autoplay hero reel. A slot holds a file; what it takes to serve one well is a
  decision for when a file exists.
- **Interactive demos.** The decisions doc's "interactive bits" for #19 are not
  attempted — an embedded live product needs a product decision and an
  authentication story, and neither is a copy question.
- **Rewriting the case studies.** The existing prose is approved copy from
  `docs/site-copy.md`. This track adds layers above it and does not touch it.
- **Growing the chat corpus.** The plain-language prose lives on the pages, not
  in `content/knowledge/` — the knowledge base has a stated ~8k token budget and
  this text says nothing the model cannot already say.
- **A recruiter/engineer toggle.** Decisions #26 says the recruiter chips likely
  replace the current ones rather than adding a mode, and they do.
- **The Nokia and Dell media surfaces.** Nokia's work is confidential by its own
  case study; Dell's is eight years old. #19 names one project.
