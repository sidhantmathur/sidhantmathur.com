# 00 — Decisions and design tokens

Read this before any phase doc. It resolves every conflict between the three
source-of-truth documents and pins down decisions the phase docs depend on.

Sources:
- `docs/portfolio-build-spec.md` — architecture, phases, chatbot design
- `docs/site-copy.md` — ALL site text (wins every text conflict)
- `docs/Sidhant Mathur - Portfolio.html` — design export (layout, tokens, visual direction ONLY; its text is throwaway)

---

## 1. Precedence rule

The design export contains its own copy (a different hero heading, metrics like
"104 games / month" and "290 players", "CTO / cofounder", "set in Geist — built
by hand", `hello@sidhantkmathur.com`). **None of that text ships.** Every string
on the site comes from `site-copy.md`, verbatim, sentence case, with `[TODO]`
markers left visible. The export contributes: palette, type treatment, spacing,
borders, layout patterns, and the sticky chat bar concept.

## 2. Design tokens (extracted from the design export)

Define as CSS variables in `globals.css` and map into Tailwind (v4 `@theme`) and
shadcn variables. Radius is 0 everywhere (`--radius: 0rem`).

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FAF7F1` | Page background |
| `--ink` | `#1B1916` | Primary text, strong 1px borders, filled accents |
| `--ink-soft` | `#4A463F` | Body/secondary text |
| `--muted` | `#6E6A62` | Mono section labels ("Selected work") |
| `--faint` | `#9B968C` | Metadata labels, input placeholder, footer text |
| `--hairline` | `#E0DBD1` | Light 1px borders / section dividers |
| `--surface` | `#F2EEE5` | Light surface; also text color on the dark band |
| `--surface-raised` | `#FFFEFB` | Sticky chat bar background |
| `--band` | `#131110` | Dark stat band background |
| `--band-muted` | `#97928A` | Secondary text on the dark band |

shadcn mapping: `background=paper`, `foreground=ink`, `muted-foreground=faint`,
`border=hairline`, `primary=ink`, `primary-foreground=paper`, `radius=0`.

## 3. Typography

Fonts via `next/font/google`: **Geist** (400/500/600/700) and **Geist Mono**
(400/500). No `geist` npm package — `next/font/google` covers it with zero deps.

- **H1 (hero)**: Geist **Mono**, `clamp(32px, 5vw, 58px)`, line-height 1.12,
  weight 500, letter-spacing −0.04em, max-width ~22ch. One key word gets the
  inverted-ink highlight: `background: var(--ink); color: var(--paper);
  padding: 0 0.14em`.
- **Card/page titles (h2)**: Geist Sans, 30px, weight 600, letter-spacing −0.025em.
- **Body**: Geist Sans 15–17px, line-height 1.6, color `--ink-soft`, max-width ~52–58ch.
- **Mono metadata/labels/links/chat**: Geist Mono 11–13px. Section labels 12px
  in `--muted`. Links are mono 12px, no underline, underline on hover, with
  `→` (internal) or `↗` (external) suffixes.
- **Stat band number**: `clamp(96px, 16vw, 210px)`, weight 700, letter-spacing
  −0.05em, line-height 0.78, scanline treatment:
  `background: repeating-linear-gradient(0deg, #F2EEE5 0px, #F2EEE5 5px,
  rgba(242,238,229,0) 5px, rgba(242,238,229,0) 8px); background-clip: text;
  color: transparent;`
- Sentence case everywhere. No all-caps, no `text-transform: uppercase`.

## 4. Layout patterns (from the export)

- Content max-width **1200px**, horizontal padding **48px** (less on mobile),
  sections separated by 1px `--hairline` rules; strong `--ink` rules for
  emphasis (header bottom border, card borders, first row of tables).
- **Header**: full-width mono 12px strip, `justify-between`, 14px/40px padding,
  1px ink bottom border. Three slots: name · status line · email link.
- **Project cards**: 1px ink border, sharp corners, numbered corner badge
  (`01`, mono 11px, ink background, paper text, absolute top-left), optional
  right image column (`grid-template-columns: 1fr minmax(280px, 420px)`, 1px ink
  divider, `filter: grayscale(0.15)`), and a 4-column mono metadata strip along
  the bottom (`role / stack / status / link`, 12px, labels in `--faint`,
  1px ink top border, `--hairline` column dividers).
- **Experience table**: rows `grid-template-columns: 140px 1fr 1fr 130px`,
  baseline-aligned, 18px vertical padding, ink rule above first row and below
  last, hairline rules between.
- **Dark stat band**: full-bleed `--band` background, inner content constrained
  to 1200px, big number left, right-aligned mono 13px caption in `--band-muted`
  (max-width 30ch).
- **Sticky chat bar** (site-wide chat entry): fixed bottom, 44px tall, 1px ink
  top border, `--surface-raised` background, mono 13px; `>` prefix left,
  borderless transparent input, `enter ↵` hint right in `--faint`. Body gets
  `padding-bottom: 44px` so content never hides behind it.
- **Footer**: mono 11px in `--faint`, hairline top border, `justify-between`.

## 5. Copy → design conflict resolutions (copy wins)

| Surface | Design export says | Ships instead (site-copy.md) |
|---|---|---|
| Hero heading | "Technical operator…" | "I build internal tools, revenue systems, and the occasional whole product." (highlight treatment on **revenue systems** or a single word within it — pick one word, e.g. "revenue") |
| Hero subline | "Sales operations at Nokia by day…" | Copy's subline ("I work in sales operations at Nokia…") |
| Hero metadata | header status line | "Sidhant Mathur · Toronto, ON · Open to new roles" (mono, small) |
| Hero CTAs | none in export | Primary button "Ask me anything" (focuses/opens chat) + secondary link "View resume" — style per system: ink-filled rectangle button, mono secondary link |
| Stat band | "290 / players booked…" | "4–6 hours per day" + copy's caption (Nokia quarter-end stat). Number rendered as "4–6" with the scanline treatment; full stat text as the caption |
| Card 01 metrics | "104 games / month" | No invented metrics. 4th strip cell becomes the case-study link ("Read the case study →") |
| Card 01 role | "CTO / cofounder" | "Founder and developer" |
| Card 02 | Nokia, "SFDC, Python, SQL" | Copy's Nokia card (role, stack, status, description) |
| Card 03 | absent | Dell card exists in copy — same card pattern, no image |
| Email | hello@sidhantkmathur.com | Footer link text per copy ("GitHub · LinkedIn · Email"); hrefs resolved from the resume source: `https://github.com/sidhantmathur`, `https://www.linkedin.com/in/sidhantmathur`, `mailto:sidhant185@gmail.com` |
| Footer | "set in Geist — built by hand" | "© 2026 Sidhant Mathur · Toronto, ON · GitHub · LinkedIn · Email" |
| Experience table | 2024/2023 dates, invented rows | **Build it** — row facts now come from `docs/resume/resume-source.md` (see §11). Rows: 2025 — A Darle 20 — Founder and developer → details → `/projects/adarle20`; 2022 — Nokia — Sales operations → details → `/projects/nokia`; 2019 — Freelance web development — Self-employed (no link); 2018 — Dell — Marketing intern → details → `/projects/dell-ml`; final row "full history" → `/resume`. Role phrasing follows site-copy card wording where an equivalent exists |

## 6. Architecture decisions (pinned)

- **Static-first**: every page pre-rendered. The only server route is
  `POST /api/chat`. No other dynamic rendering; no middleware beyond what the
  chat route needs.
- **No database, no RAG, no chat persistence** (spec §1, §3). Knowledge base =
  `content/knowledge/*.md` concatenated into the system prompt at build time
  (generated module, ≤8k tokens), with Anthropic prompt caching via AI Gateway.
- **Model**: `anthropic/claude-haiku-4.5` through Vercel AI Gateway (model
  string only — no API key management in code; `AI_GATEWAY_API_KEY` locally).
- **Chat entry**: the design's sticky bottom bar IS the site-wide launcher
  (replaces the spec's "floating launcher"). Typing there routes to `/chat`
  (full-page mode) carrying the first message. Suggested-question chips from
  copy appear on `/chat` empty state.
- **Rate limiting**: `@upstash/ratelimit` per-IP (20 msgs/hour) + 10-message
  conversation cap + 500 chars/message + max 12 messages history +
  `maxOutputTokens` ≈ 600. When Upstash env vars are absent (local dev), fall
  back to an in-memory limiter so the site runs with zero setup.
- **Graceful degradation**: with no `AI_GATEWAY_API_KEY`, the chat UI renders
  and returns the copy's error state — the static site must be fully viewable
  locally with an empty `.env.local`.
- **MDX**: `@next/mdx` pipeline; case-study body content lives in
  `content/*.mdx`, rendered by static routes. Knowledge base is plain `.md`.
- **About**: no `/about` route in the sitemap — render the About copy as a
  section on the homepage (after projects, before/near the chat teaser).
- **`/now`**: skip for v1 (spec marks it optional; no copy exists for it).
  Listed as a future task, not scaffolded.
- **Dark mode**: not in v1 — **signed off by Sidhant 2026-07-03**. The design
  export defines a single warm-paper theme and no dark tokens. Set
  `color-scheme: light`.
- **⌘K palette**: **in scope for Phase 4** — Sidhant approved the shadcn
  `command` component (vendors the `cmdk` dependency). Keep it small:
  navigate to the sitemap routes + a "Ask a question" action that focuses the
  sticky chat bar.
- **Analytics**: PostHog via `posthog-js`, loaded only when
  `NEXT_PUBLIC_POSTHOG_KEY` is set. Events: `chat_message_sent`,
  `chat_rate_limited`, `chat_error`, `resume_download`, `contact_click`.
- **Fonts**: `next/font/google` (Geist, Geist Mono). No extra font packages.
- **Dependencies allowed** (all named in the spec or approved by Sidhant —
  nothing else without asking): `next react react-dom typescript tailwindcss
  @next/mdx ai @ai-sdk/react zod @upstash/ratelimit @upstash/redis posthog-js`
  + whatever the shadcn CLI vendors for the specific components we generate
  (incl. `cmdk` via the `command` component — approved for the ⌘K palette).
- **shadcn/ui**: init with radius 0; only add components actually used
  (expected: `button` in Phase 1, `command` in Phase 4 — the design is mostly
  bespoke primitives; don't install the whole registry).

## 7. Assets

- The A Darle 20 screenshot for card 01 is embedded in the design export as a
  base64 PNG (manifest id `7e8dbf91-…`, ~1.2MB). Phase 1 extracts it to
  `public/images/adarle20-listings.png` (node one-liner in the phase doc) and
  optimizes via `next/image`.
- OG image (1200×630) generated statically with `opengraph-image.tsx` using the
  token palette — paper background, ink mono text, site title + metadata line.

## 8. Routes (final sitemap for v1)

```
/                      home (hero, stat band, projects ×3, about, chat teaser, experience)
/projects/adarle20     flagship case study
/projects/nokia        case study (sanitized, no screenshots)
/projects/dell-ml      short case study
/chat                  full-page chat
/resume                HTML resume + PDF download link
/resume.md             raw markdown (route handler serving text/markdown)
/colophon              how this site was built
/llms.txt              AI-readable index (route handler or public file)
/api/chat              POST only — the single server route
404                    not-found page (copy: "There's nothing at this address…")
```

## 9. Environment variables

`.env.local` (git-ignored) with an `.env.example` checked in:

```
AI_GATEWAY_API_KEY=          # chat works without it only in error-state form
UPSTASH_REDIS_REST_URL=      # optional locally (in-memory fallback)
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_POSTHOG_KEY=     # optional; analytics off when empty
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## 10. Copy gaps → visible [TODO]s (do not invent text)

- A Darle 20 "Where it stands" numbers — `[TODO]` stays visible on the page.
- Resume "last updated [TODO: month year]" — stays visible (suggested value:
  "July 2026", the resume-source extraction date — Sidhant confirms).
- Colophon GitHub link — `[TODO: confirm repo is public before linking]` stays.
- Resume PDF file (`public/resume.pdf`) — morning checklist (export from the
  docx).

## 11. Resume source (added 2026-07-03)

Sidhant provided his resume; it is the authoritative source for resume and
experience content. Checked into the repo at:

- `docs/resume/Sidhant_Mathur_Resume_GTM.docx` — original
- `docs/resume/resume-source.md` — extracted markdown (use this)

Rules:
- `/resume` page body, `/resume.md`, and `content/knowledge/resume.md` are
  built from `resume-source.md` verbatim (structure may adapt to the page
  layout; facts and wording don't change). The `[TODO]` resume skeleton from
  earlier drafts is superseded.
- **Phone number never ships** — exclude it from every web-published surface
  (page, /resume.md, knowledge base). Email/LinkedIn/GitHub/site URL are fine.
  (Pinned; flagged once in the morning checklist for sign-off.)
- Facts it resolves: Canadian citizen (FAQ, no TODO needed); roles targeted =
  "GTM engineering, revenue systems, and solutions engineering roles at
  AI-native companies" (summary, verbatim); LinkedIn/GitHub URLs (§5);
  experience-table rows (§5). "What he's NOT looking for" is still absent —
  remains a `[TODO]` in `faq.md`.
- Where the resume and `site-copy.md` phrase the same fact differently (e.g.
  "Founder & full-stack developer" vs. copy's "Founder and developer"), the
  copy wins on site surfaces and the resume wins on `/resume` + `/resume.md`.
