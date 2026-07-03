# Phase 2 — Static pages

Builds on Phase 1 (scaffold, design tokens in `globals.css`/Tailwind `@theme`,
Geist/Geist Mono via `next/font/google`, layout primitives, header, footer —
note: Phase 1 does NOT build any chat UI; the static sticky-bar shell is
built in this phase, §4a). This phase assembles every static route and its copy.
`00-decisions.md` is authoritative on every conflict; `site-copy.md` is the
only source of shipped text.

---

## 1. Goal & exit criteria

Goal: every route in `00-decisions.md` §8 renders statically, fully wired with
real copy, except `/api/chat` (server route, Phase 3) and `/chat` (full-page
chat UI, Phase 3 — the sticky bar and homepage teaser render as static UI only
in this phase, per §4 below).

Exit criteria:

- [ ] `npm run build` completes with zero errors.
- [ ] Every route below renders and is marked static (○ or ●) in the build
      output, except `/api/chat` (doesn't exist yet) and `/chat` (doesn't
      exist yet — not scaffolded until Phase 3).
- [ ] Every visible string on every page traces to a line in `site-copy.md`
      (see the copy map in §3). No invented text, no leftover design-export
      copy (no "290", no "104 games / month", no "CTO / cofounder", no
      `hello@sidhantkmathur.com`, no "set in Geist — built by hand").
- [ ] All `[TODO: ...]` markers from `site-copy.md` and `00-decisions.md` §10
      are visibly rendered on the page, not stripped or resolved.
- [ ] Sentence case everywhere; no `text-transform: uppercase`; no all-caps
      strings.

---

## 2. MDX pipeline

Minimal `@next/mdx` setup — no remark/rehype plugin zoo. Case-study bodies are
content, not layout; layout (title, subtitle, breadcrumb, metadata) is a React
shared component, not MDX.

### 2.1 `next.config.ts`

```ts
import createMDX from '@next/mdx';

const withMDX = createMDX({
  // no remark/rehype plugins — GFM-less, plain MDX is enough for these three files
});

const nextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
};

export default withMDX(nextConfig);
```

### 2.2 `mdx-components.tsx` (project root, required by `@next/mdx` App Router convention)

Maps raw MDX elements to token typography so case-study prose matches §3
typography in `00-decisions.md` without repeating classes in every `.mdx`
file:

- `h3` → the case studies' `###` headings → Geist Sans, same weight scale as
  card titles but smaller (e.g. 20px/600), `--ink`, margin-top spacing to
  read as section breaks.
- `p` → Geist Sans body, 15–17px, line-height 1.6, `--ink-soft`, max-width
  ~58ch (matches §3 body token).
- `strong`/`em` → inherit, no color override.
- No custom `a` styling beyond the shared mono-link pattern if a case study
  ever links out (none currently do — case studies are self-contained prose).
- `[TODO: ...]` bracketed text is NOT a special MDX component — it ships as
  literal text inside the paragraph it appears in (A Darle 20 "Where it
  stands"). Apply the visual treatment (mono, faint, bracketed — see §5) via a
  small inline span only if it can be done without altering the literal
  string; otherwise plain paragraph text is acceptable and still satisfies
  "TODO stays visible."

### 2.3 Content files

Statically imported by their route (`import CaseStudy from '@/content/adarle20.mdx'`
or Next's MDX-as-page-component pattern — implementer's call, both are
static). One file per case study, body only (### sections), no title/subtitle
(those come from the shared case-study layout, see §5):

- `content/adarle20.mdx` — sections: The problem / What I built / What it
  runs on / Where it stands / What I'd tell a hiring manager.
- `content/nokia.mdx` — sections: The problem / What I built / What I'd tell
  a hiring manager. Includes the confidentiality note (part of "What I
  built", per copy — see §5).
- `content/dell-ml.mdx` — no headings, two paragraphs (copy has no ### 
  subsections for Dell — it's continuous prose).

### 2.4 Knowledge base note

`content/knowledge/*.md` (resume.md and friends) is a separate, plain-`.md`
concatenation pipeline for the Phase 3 chat system prompt — not part of the
MDX/page pipeline. `/resume.md` (§6) serves `content/knowledge/resume.md`
directly as text, unrelated to `@next/mdx`. Don't conflate the two.

---

## 3. Copy map

Every block in `site-copy.md` mapped to its destination. Quote headings
exactly as written in the source. "Line(s)" cites `site-copy.md` line numbers
for traceability during the copy-diff audit (§11).

| site-copy.md block | Lines | Destination |
|---|---|---|
| Meta → Site title | 10 | Root `layout.tsx` `metadata.title` = "Sidhant Mathur" (see §10) |
| Meta → Meta description | 11–13 | Root `layout.tsx` `metadata.description`; also feeds `/llms.txt` (§9) |
| Hero → Heading | 21–22 | Home, hero `<h1>`, highlight on "revenue" (per §5 resolution below) |
| Hero → Subline | 24–27 | Home, hero `<p>` |
| Hero → Metadata line | 29–30 | Home, hero mono metadata line |
| Hero → Primary button | 32 | Home, hero primary button "Ask me anything" |
| Hero → secondary link | 33 | Home, hero secondary link "View resume" |
| Stat block | 37–39 | Home, dark stat band — "4–6" as scanline number, line 38 text as caption |
| Projects → Section heading | 43 | Home, "Selected work" mono label above cards |
| Card 1 — A Darle 20 (all fields) | 45–53 | Home, card 01 (image column, `public/images/adarle20-listings.png`) |
| Card 2 — Reporting tools at Nokia | 55–64 | Home, card 02 (no image) |
| Card 3 — Sales prediction model at Dell | 66–74 | Home, card 03 (no image) |
| Chat panel → Heading | 78 | Home, chat teaser section heading |
| Chat panel → Body | 79–81 | Home, chat teaser section body |
| Chat panel → Suggested questions (3 chips) | 83–86 | Home, chat teaser static chips |
| Chat panel → Input placeholder | 88 | Home, chat teaser static input (disabled/decorative — see §4) |
| Chat panel → Disclaimer | 89–90 | Home, chat teaser small mono disclaimer |
| A Darle 20 case study — Title, Subtitle | 96–97 | `/projects/adarle20`, shared layout header |
| A Darle 20 — ### The problem | 99–103 | `content/adarle20.mdx` |
| A Darle 20 — ### What I built | 105–117 | `content/adarle20.mdx` |
| A Darle 20 — ### What it runs on | 119–121 | `content/adarle20.mdx` |
| A Darle 20 — ### Where it stands (incl. `[TODO: one or two concrete numbers...]`) | 123–128 | `content/adarle20.mdx` — TODO renders visibly |
| A Darle 20 — ### What I'd tell a hiring manager | 130–133 | `content/adarle20.mdx` |
| Nokia case study — Title, Subtitle | 139–140 | `/projects/nokia`, shared layout header |
| Nokia — ### The problem | 142–146 | `content/nokia.mdx` |
| Nokia — ### What I built (incl. confidentiality "Note:" paragraph) | 148–160 | `content/nokia.mdx` |
| Nokia — ### What I'd tell a hiring manager | 162–164 | `content/nokia.mdx` |
| Dell case study — Title, Subtitle | 170–171 | `/projects/dell-ml`, shared layout header |
| Dell — body (two paragraphs, no ### headings) | 173–181 | `content/dell-ml.mdx` |
| About | 187–196 | Home, About section (no `/about` route — §6 of `00-decisions.md`) |
| Resume page → Heading, Body (incl. `[TODO: month year]`), Button | 202–206 | `/resume` page chrome |
| Colophon → Heading, Body (incl. `[TODO: confirm repo is public...]`) | 212–221 | `/colophon` |
| 404 page | 227 | `not-found.tsx` |
| Footer | 228 | Global footer (Phase 1 component, content from copy) |
| Chat empty state | 229–230 | `/chat` empty state (Phase 3 — not built this phase, but string is reserved/unused until then) |
| Chat error state | 231–232 | `/api/chat` error UI (Phase 3) |
| Chat rate-limit state | 233–234 | `/api/chat` rate-limit UI (Phase 3) |

Notes on cells called out in the task brief:

- **Image placement**: only card 01 (A Darle 20) gets
  `public/images/adarle20-listings.png` in the right image column. Cards 02
  and 03 render the no-image card variant (single-column body, no divider,
  no image grid).
- **Card 02 "internal — no screenshots"-style note**: does **not** exist in
  `site-copy.md`. The design export's card 02 has a "internal — no
  screenshots" label where the case-study link goes, but the copy's Nokia
  card (lines 55–64) has a normal "Read the case study" link like the other
  two. Ship the link, not the export's label. (The *case study page itself*
  does carry a confidentiality note — see the Nokia `### What I built`
  paragraph at lines 159–160 — that's a different, legitimate piece of copy
  and ships on `/projects/nokia` only, not as a home-card badge.)
- **Card metadata strip** (all three cards): 4 cells = role / stack / status
  / link, values verbatim from copy:
  - Card 01: role "Founder and developer" (per `00-decisions.md` §5 override
    of the export's "CTO / cofounder" — copy line 50 confirms "Founder and
    developer"), stack "TypeScript, Next.js, Supabase, Stripe Connect",
    status "Live at adarle20.com", link "Read the case study →" (→ suffix
    per §3 typography rule for internal links).
  - Card 02: role "Sales operations specialist", stack "Power Apps, Power BI,
    SQL, DAX, Salesforce", status "In production since 2024", link "Read the
    case study →".
  - Card 03: role "Marketing intern", stack "Python, Azure", status "2018",
    link "Read the case study →".
- **No invented metrics anywhere** (`00-decisions.md` §5): card 01's 4th
  strip cell is the case-study link, not a metric — matches copy, which has
  no metrics field for any card.

---

## 4a. Sticky chat bar — static shell (global)

Neither Phase 1 nor Phase 3 builds the *static* sticky bar; it lands here so
the layout is complete before chat logic exists. Build
`components/chat/sticky-bar.tsx`, rendered in the root layout on every page:

- Visual per `00-decisions.md` §4: fixed bottom, 44px tall, 1px `--ink` top
  border, `--surface-raised` background, Geist Mono 13px; `>` prefix left;
  borderless transparent input; `enter ↵` hint right in `--faint`. Body gets
  `padding-bottom: 44px` (set globally in the root layout wrapper).
- Input placeholder: "Ask a question about my work" (site-copy.md → Chat
  panel → Input placeholder, line 88 — NOT the design export's lowercase
  "ask anything about sidhant").
- Phase 2 behavior: input renders and accepts focus but submits nowhere
  (no-op `onSubmit`/readOnly is fine). Phase 3 replaces the no-op with
  navigation to `/chat` carrying the typed question.

## 4. Homepage assembly

Route: `/`. Section order top to bottom:

1. **Header** — Phase 1 component, unchanged. Three slots: name · status
   line · email link. (Header content itself was pinned in Phase 1 using
   `00-decisions.md` §4 pattern + copy's footer email resolution; not
   re-specified here.)

2. **Hero**
   - `<h1>` Geist Mono, `clamp(32px,5vw,58px)`, the exact heading from copy
     line 22: "I build internal tools, revenue systems, and the occasional
     whole product." One word gets the inverted-ink highlight
     (`background: var(--ink); color: var(--paper); padding: 0 0.14em`).
     Per `00-decisions.md` §5, pick **one word inside "revenue systems"** —
     use **"revenue"** (matches the §5 example exactly; pinning it removes
     the open choice).
   - `<p>` subline, copy lines 25–27, Geist Sans body treatment.
   - Mono metadata line, copy line 30: "Sidhant Mathur · Toronto, ON · Open
     to new roles."
   - CTA row: primary button "Ask me anything" (ink-filled rectangle,
     `radius:0`) — in Phase 2 this is a static button that focuses the sticky
     chat bar input from §4a (no `/chat` route exists yet, so it must not
     link there). Secondary link "View resume" → `/resume`, mono link style
     with `→` suffix (internal route).

3. **Stat band** (dark, full-bleed `--band`)
   - Giant number "4–6" (not "4–6 hours per day" — the "hours per day" part
     is caption context per `00-decisions.md` §5: *"Number rendered as '4–6'
     with the scanline treatment; full stat text as the caption"*). Scanline
     `background-clip:text` treatment per §3 typography token.
   - Caption, right-aligned mono 13px, `--band-muted`, max-width 30ch: use
     copy's stat text (line 38) — "Time saved for finance staff at
     quarter-end close by a reporting tool I built and rolled out at Nokia."
     Do not also repeat "4–6 hours per day" verbatim in the caption since the
     number already carries "4–6"; render the caption as written (it doesn't
     restate the number, so no conflict — ship line 38 verbatim, unedited).

4. **Selected work** (mono label "Selected work", copy line 43)
   - Card 01 — A Darle 20: image column
     (`public/images/adarle20-listings.png`, `next/image`, `filter:
     grayscale(0.15)` per layout pattern), numbered badge "01", title "A
     Darle 20", body copy lines 46–48, metadata strip per §3 notes above.
   - Card 02 — Reporting tools at Nokia: no image, single-column body,
     numbered badge "02", title "Reporting tools at Nokia" (card heading —
     copy doesn't give cards separate short titles vs. case-study titles;
     use the card's own heading text "Card 2 — Reporting tools at Nokia" →
     strip the "Card 2 —" editorial prefix, ship "Reporting tools at Nokia"
     as the card `<h2>`), body copy lines 56–59, metadata strip.
   - Card 03 — Sales prediction model at Dell: no image, numbered badge "03",
     title "Sales prediction model at Dell" (same prefix-stripping logic),
     body copy lines 67–69, metadata strip.
   - No card gets an "internal — no screenshots" note (confirmed absent from
     copy — see §3).

5. **Chat teaser section** (static in Phase 2 — no live chat logic)
   - Heading "Ask about my work" (line 78).
   - Body, lines 79–81.
   - Three chips rendered as static, non-interactive-looking UI elements
     (mono pill/tag style consistent with the design's chip pattern) with
     exact text from lines 84–86: "What did Sidhant build at Nokia?", "How
     does A Darle 20 work?", "Is he a fit for a solutions engineering role?"
     Chips have no click handler yet (Phase 3 wires them to `/chat`) — either
     omit interactivity entirely or, if Phase 1 scaffolded a shared Button/Link
     primitive, render them as visually-styled but functionally inert `<span>`s
     to avoid shipping dead links.
   - Input placeholder text (line 88) rendered on a disabled-looking static
     input matching the sticky-bar visual pattern (this is a section-level
     echo of the concept, not the sticky bar itself, which already exists
     site-wide from Phase 1).
   - Disclaimer, small mono, line 89–90, verbatim.

6. **About section** (no `/about` route — `00-decisions.md` §6)
   - Renders copy lines 187–196 as a homepage section, positioned after
     projects, at or near the chat teaser (per §6: "after projects,
     before/near the chat teaser"). Pin the order as: Selected work → Chat
     teaser → About, so About reads as a closing personal note before the
     footer/experience links, rather than interrupting projects → chat flow.
     (Flagging: `00-decisions.md` says "near" not "before/after" definitively
     — this ordering is a reasonable pin, not a re-derivation; flagged in the
     final summary per instructions.)
   - No special heading token specified in copy (About has no explicit
     "Heading:" line, unlike Hero/Resume/Colophon) — use "About" as the
     section's mono section label (matching the "Selected work" pattern) for
     visual consistency; this is a layout necessity, not invented body copy.

7. **Experience table** (updated 2026-07-03 — now IN scope)
   - Sidhant provided his resume (`docs/resume/resume-source.md` — see
     `00-decisions.md` §11), which supplies the row facts the copy lacked.
     Build the table per the layout pattern (`00-decisions.md` §4: rows
     `140px 1fr 1fr 130px`, baseline-aligned, ink rule above first row and
     below last, hairline rules between, mono dates/links). Rows:

     | Date (mono) | Name | Role | Link (mono, right) |
     |---|---|---|---|
     | 2025 — | A Darle 20 | Founder and developer | details → `/projects/adarle20` |
     | 2022 — | Nokia | Sales operations | details → `/projects/nokia` |
     | 2019 — | Freelance web development | Self-employed | (no link) |
     | 2018 | Dell | Marketing intern | details → `/projects/dell-ml` |
     | full history | Everything else, in one page | | resume → `/resume` |

     Role phrasing follows site-copy card wording where an equivalent exists
     ("Founder and developer", "Marketing intern"); dates come from the
     resume (A Darle 20 Feb 2025; Nokia from Oct 2022 across both roles;
     freelance May 2019; Dell 2018). Do not add resume bullet content here —
     rows only; detail lives on the case-study pages and `/resume`.
   - Position: after About, before the global Footer.
   - Footer renders Phase 1's component with copy line 228 verbatim: "©
     2026 Sidhant Mathur · Toronto, ON · GitHub · LinkedIn · Email" — hrefs
     resolved per `00-decisions.md` §5 (github.com/sidhantmathur,
     linkedin.com/in/sidhantmathur, `mailto:sidhant185@gmail.com`).

---

## 5. Case-study pages

Shared layout component (e.g. `app/projects/[slug]/layout.tsx` or a
`CaseStudyLayout` used by three separate `page.tsx` files — implementer's
choice, both are static) renders, in order:

1. Mono breadcrumb/back link — "← Selected work" or similar, pointing to `/`
   (exact wording not specified in copy; use a directional link with `←`
   prefix per the mono-link pattern in §3 of `00-decisions.md`; this is
   chrome, not body copy, so it isn't copy-constrained, but keep it terse and
   sentence case, no invented tagline).
2. Title (`<h1>` or page `<h2>` per the card/page-title token, 30px/600) —
   exact string from copy's "Title:" line.
3. Subtitle — exact string from copy's "Subtitle:" line, styled as the body
   token or a slightly larger lede treatment (implementer's call within
   token bounds).
4. Prose body — the imported `.mdx` file, rendered through
   `mdx-components.tsx` mappings (§2.2). Each `###` in copy becomes an `h3`
   in the MDX source; headings quoted exactly as written in `site-copy.md`
   ("The problem", "What I built", "What it runs on", "Where it stands",
   "What I'd tell a hiring manager" — case studies use whichever subset
   applies; Dell has none).

Per-page specifics:

- **`/projects/adarle20`** — full five-section body per §3 copy map. The
  "Where it stands" section's `[TODO: one or two concrete numbers — bookings,
  hosts, or revenue range — pending what we're comfortable sharing.]` renders
  literally, visibly, inline in the paragraph. Suggested style (not
  mandatory, doesn't change the string): wrap just the bracketed span in a
  small inline treatment — mono, `--faint` color, keep the brackets — e.g.
  `<span class="todo-marker">[TODO: ...]</span>` with `font-family:
  var(--font-mono); color: var(--faint);`. The literal text
  "[TODO: one or two concrete numbers...]" must remain intact character for
  character.
- **`/projects/nokia`** — three-section body. The confidentiality note
  ("Note: this work is internal to Nokia, so screenshots and specifics are
  limited by confidentiality. The numbers above are ones I can stand
  behind.") ships as the closing paragraph of "What I built" — it's part of
  that section in copy (lines 159–160 fall under the `### What I built`
  heading, after the two-things narrative), not a separate heading. Do not
  invent a fourth `### Confidentiality` heading — that would be adding
  structure copy doesn't have.
- **`/projects/dell-ml`** — short: no `###` headings at all, just the two
  paragraphs from lines 173–181 ("During a summer internship in 2018..." and
  "It was an internship project..."). Layout still renders Title/Subtitle
  chrome; the MDX file is prose-only, two `<p>` blocks.

---

## 6. Resume page

### 6.1 `/resume`

- Heading "Resume" (line 202).
- Body: line 203–205 verbatim, including the literal `[TODO: month year]`
  marker inside "last updated [TODO: month year]" — rendered visibly (same
  faint-mono-bracket treatment as §5, optional styling, mandatory literal
  text) — and the `/resume.md` cross-reference sentence ships as plain text
  with `/resume.md` as an actual link to that route.
- Button "Download PDF" — points at `/resume.pdf`. That file does not exist
  yet (extracting/writing the actual PDF is a morning task per the brief, not
  a Phase 2 code task). Ship the `<a href="/resume.pdf" download>` anyway;
  note explicitly in the Phase checklist (§11) and here: **this button 404s
  until the PDF is manually added to `public/resume.pdf`.** Do not fake a
  placeholder PDF and do not block the phase on it.
- Resume body (updated 2026-07-03): **build from
  `docs/resume/resume-source.md` verbatim** (`00-decisions.md` §11) —
  summary, all five experience entries, education, technical skills,
  "Canadian citizen". **Exclude the phone number** (never ships on any web
  surface); email/LinkedIn/GitHub/site URL are fine. Structure may adapt to
  the page layout; facts and wording don't change. The `[TODO]` skeleton
  below is **superseded** — kept only as a fallback shape if the resume
  source were ever unavailable:

  ```
  ## Experience

  ### Nokia — Sales operations specialist
  [TODO: start date] — present · Toronto, ON
  - Built a self-serve Power App for quarterly executive reporting, used by
    80+ stakeholders across seven regions; replaced a manual collection
    process saving finance staff 4–6 hours a day at quarter-end close.
  - Owned migration of sales reporting from Salesforce Analytics to Power BI
    for 150+ users — data modeling, SQL/DAX transformation logic, global
    rollout.

  ### A Darle 20 — Founder and developer
  [TODO: start date] — present
  - Designed and shipped a marketplace for tabletop game sessions in Latin
    America: bookings, payments (Stripe Connect, incl. OXXO cash rails),
    chat, refunds, notifications — directing AI coding agents through the
    full build.

  ### Dell — Marketing intern
  2018
  - Built a Python model predicting sale outcomes at 91% accuracy; surfaced
    20,000 leads representing $129M in pipeline.

  ## Education
  [TODO: degree name, institution, graduation year — business degree per
  About section] · [TODO: bootcamp name and year]

  ## Skills
  [TODO: derive a skills list strictly from stack fields already listed in
  site-copy.md's project cards — TypeScript, Next.js, Supabase, Stripe
  Connect, Power Apps, Power BI, SQL, DAX, Salesforce, Python, Azure — do not
  add technologies not named in copy]
  ```

  (Superseded fallback ends here — with `resume-source.md` present, use it
  and ignore the skeleton.)

### 6.2 `/resume.md`

- Route handler: `app/resume.md/route.ts`.
- Reads `content/knowledge/resume.md` (plain markdown, same skeleton content
  as §6.1 but as raw markdown, no page chrome) and returns it with
  `Content-Type: text/markdown; charset=utf-8`.
- Statically generated: use `export const dynamic = 'force-static'` (or
  Next's default static behavior for a route handler with no dynamic
  input — no request-derived logic here) so it's produced at build time, not
  per-request.
- `content/knowledge/resume.md` is the same file referenced by the Phase 3
  chat knowledge base concatenation (`00-decisions.md` §6) — one file, two
  consumers (this route handler, and later the system-prompt builder). Don't
  create a second copy.

---

## 7. Colophon

Route: `/colophon`.

- Heading: "How this site was built" (line 212).
- Body: lines 214–221 verbatim, two paragraphs:
  1. "Next.js, TypeScript, and Tailwind, deployed on Vercel. Type is Geist
     Sans and Geist Mono. The chat assistant runs on Claude through Vercel's
     AI Gateway, with the knowledge base injected directly into the prompt —
     at this scale, a vector database would be complexity for its own sake,
     so there isn't one."
  2. "Most of the code was written by AI agents working from a build spec;
     the decisions, copy, and mistakes are mine. The spec, design brief, and
     source are on GitHub. **[TODO: confirm repo is public before
     linking]**"
- The GitHub reference in paragraph 2 has no link yet — ship it as plain
  text with the `[TODO: confirm repo is public before linking]` marker
  visible (faint-mono-bracket treatment optional, same as §5/§6). Do not
  add an `<a href>` to GitHub until that TODO is resolved — linking now
  would contradict the marker's own instruction.

---

## 8. 404

- `app/not-found.tsx`.
- Copy line 227 verbatim: "There's nothing at this address. Head back home."
- "Head back home" — render as a link back to `/` if the design pattern
  supports inline links in body text (mono link, `→` suffix, per §3
  typography); otherwise plain text is acceptable since copy doesn't
  explicitly mark it as a hyperlink. Pin: make it a link (`→` home), since a
  dead-end 404 with no way back would be a poor default and the sentence
  reads as an implicit CTA.

---

## 9. `/llms.txt`

Route handler (`app/llms.txt/route.ts`, `force-static`) or a static file in
`public/llms.txt` — prefer the route handler for consistency with
`/resume.md` and so content can be composed from the same copy constants
rather than hand-duplicated in a public file. Plain text, one-line
descriptions drawn only from existing copy (meta description, card
descriptions, page headings) — nothing invented. Proposed exact contents:

```
# Sidhant Mathur

Sales operations specialist and builder. I make internal tools and revenue
systems at Nokia, and I run A Darle 20, a marketplace for tabletop game
sessions in Latin America.

## Pages

/ — Home: background, selected work, and a chat assistant that answers
questions about my work.
/projects/adarle20 — A Darle 20: a marketplace for tabletop game sessions in
Latin America.
/projects/nokia — Reporting tools at Nokia: internal tools for a global sales
organization.
/projects/dell-ml — Sales prediction at Dell: a machine learning model for
lead targeting, built as an intern.
/resume — Resume, with a plain-text version at /resume.md.
/colophon — How this site was built.
/chat — Ask a question about my work directly.
```

Sourcing per line: title/description block = `site-copy.md` Meta (lines
10–13); `/` line = paraphrase of the chat panel body's function (line
79–81) plus "selected work" (line 43) — kept short and factual, no new
claims; each `/projects/*` line = that case study's own Subtitle line
(97, 140, 171) verbatim; `/resume` line = derived from the resume page body
(line 204, "/resume.md" cross-reference) — factual restatement, not new
copy; `/colophon` line = its own Heading (line 212); `/chat` line = derived
from chat panel Heading "Ask about my work" (line 78) restated as a nav
description. None of these lines are new marketing copy — they are
functional index descriptions, consistent with `/llms.txt`'s job.

---

## 10. Metadata & OG

- **Root metadata** (`app/layout.tsx`):
  - `title`: exactly `"Sidhant Mathur"` (copy's Site title, line 10 — no
    template suffix, no "— Sidhant Mathur" pattern; the brief explicitly
    rules that out).
  - `description`: copy's Meta description, lines 11–13, verbatim.
- **Per-page metadata**: each route sets its own `title` (sentence case,
  drawn from that page's Heading/Title) and `description` (drawn from that
  page's Body/Subtitle, first sentence if the full body is long). No
  title-template suffix anywhere — every page's `<title>` stands alone in
  sentence case, matching the root pattern of "just the name/heading," e.g.:
  - `/` → title "Sidhant Mathur" (same as root — homepage doesn't need a
    distinct title), description = Meta description.
  - `/projects/adarle20` → title "A Darle 20", description = its Subtitle
    (line 97).
  - `/projects/nokia` → title "Reporting tools at Nokia", description = its
    Subtitle (line 140).
  - `/projects/dell-ml` → title "Sales prediction at Dell", description =
    its Subtitle (line 171).
  - `/resume` → title "Resume", description = first sentence of the resume
    body (line 203, up to "...last updated [TODO: month year].").
  - `/colophon` → title "How this site was built", description = first
    sentence of its body (line 214, up to "...Geist Mono.").
- **`opengraph-image.tsx`**: static, 1200×630, generated via Next's
  `ImageResponse` at build time (no per-request logic → statically
  cacheable). Visual: `--paper` background, `--ink` Geist Mono text, two
  lines — site title ("Sidhant Mathur") and the hero metadata line ("Sidhant
  Mathur · Toronto, ON · Open to new roles" — reuse verbatim, don't
  re-derive a different metadata string). One shared OG image for the whole
  site is sufficient for v1 (per-page OG images are not required by
  `00-decisions.md` or the spec); if per-page OG becomes desirable later,
  it's an easy follow-up, not a Phase 2 blocker.

---

## 11. Phase checklist

- [ ] `/` renders: header, hero, stat band, selected work (3 cards), chat
      teaser (static), about, experience table (5 rows per §4.7, facts from
      the resume source), footer.
- [ ] Sticky chat bar shell (§4a) renders on every route: 44px fixed bottom
      bar, copy's placeholder "Ask a question about my work", no-op submit,
      global `padding-bottom: 44px` so no content is hidden behind it.
- [ ] `/projects/adarle20` renders full case study incl. visible `[TODO]` in
      "Where it stands."
- [ ] `/projects/nokia` renders case study incl. confidentiality note inside
      "What I built."
- [ ] `/projects/dell-ml` renders two-paragraph case study, no headings.
- [ ] `/resume` renders heading/body (visible `[TODO: month year]`), Download
      PDF button (points at `/resume.pdf`, known 404 until the PDF is added
      manually), and the full resume body from
      `docs/resume/resume-source.md` — **with no phone number anywhere**.
- [ ] `/resume.md` route handler serves `content/knowledge/resume.md` as
      `text/markdown`, statically.
- [ ] `/colophon` renders both paragraphs incl. visible
      `[TODO: confirm repo is public before linking]`, no GitHub link yet.
- [ ] `404` renders copy's line with a link back home.
- [ ] `/llms.txt` renders the proposed index (§9), sourced only from existing
      copy.
- [ ] Root + per-page `metadata` set per §10; no title-template suffix
      anywhere.
- [ ] `opengraph-image.tsx` renders a 1200×630 paper/ink image with the site
      title + hero metadata line.
- [ ] `npm run build` exits 0; build output shows every route above as
      static (○ or ●); `/api/chat` and `/chat` are absent (not yet
      scaffolded — Phase 3).
- [ ] Copy diff audit: grep the built pages (or source) for exact phrases
      from `site-copy.md` to catch drift — e.g. `"I build internal tools"`,
      `"4–6 hours per day"` (in the caption context per §4.3, not literally
      concatenated with the giant number), `"Founder and developer"`,
      `"There's nothing at this address"` — and grep for banned design-export
      strings to confirm absence: `"290"`, `"104 games"`, `"CTO / cofounder"`,
      `"hello@sidhantkmathur.com"`, `"set in Geist"`.
- [ ] All `[TODO]` markers from §3/§5/§6/§7 are visible in rendered HTML
      (not stripped by MDX/markdown processing).
- [ ] `public/images/adarle20-listings.png` renders via `next/image` on card
      01 only, with `grayscale(0.15)` filter, no image on cards 02/03 or any
      case-study page.
- [ ] No all-caps text anywhere (grep for `text-transform:\s*uppercase` and
      for any hardcoded all-caps strings in new components).

---

## Flags for Sidhant (not resolved against `00-decisions.md` — surfaced, not decided)

1. **About section position** — `00-decisions.md` §6 says "after projects,
   before/near the chat teaser," which is ambiguous between About-before-chat
   and About-after-chat. This doc pins **Selected work → Chat teaser →
   About → Footer**. Revisit if a different order is intended.
2. **Homepage "Experience" table** — RESOLVED 2026-07-03: Sidhant provided
   his resume, which supplies the row facts. The table is now built per §4.7
   (`docs/resume/resume-source.md` is the source; `00-decisions.md` §11).
3. **Card 02/03 heading text** — copy labels them "Card 2 — Reporting tools
   at Nokia" / "Card 3 — Sales prediction model at Dell" with an editorial
   "Card N —" prefix. This doc strips the prefix and ships "Reporting tools
   at Nokia" / "Sales prediction model at Dell" as the on-page `<h2>`,
   treating "Card N —" as a copy-doc organizational label, not shipped text.
   Flagging in case the prefix was meant to signal something else.
4. **Back/breadcrumb link wording on case-study pages** (§5) and **404
   "head back home" as a link** (§8) — neither has literal copy in
   `site-copy.md`; both are structural chrome this doc infers is necessary
   for usable navigation. Wording is not copy-constrained by the sources but
   flagged since it's the one place this doc adds non-verbatim UI text.
