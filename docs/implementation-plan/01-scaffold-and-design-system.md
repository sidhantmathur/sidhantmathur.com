# Phase 1 — Scaffold and design system

Read `docs/implementation-plan/00-decisions.md` first. It is authoritative and
overrides `docs/portfolio-build-spec.md` and the design export on any
conflict. This doc turns those decisions into an exact build procedure.

---

## 1. Goal & exit criteria

Goal: a scaffolded Next.js repo with the design system (tokens, fonts, layout
primitives) in place and a working header + footer, ready for Phase 2
(homepage sections) and Phase 3 (chat) to build on.

Exit criteria (see §11 for the full checklist):
- `npm run build` passes with zero errors.
- `npm run dev` renders a page with the global header and footer, using real
  tokens/fonts — no default `create-next-app` boilerplate left.
- Fonts are self-hosted via `next/font/google` (no external requests at
  runtime).
- `--radius: 0` verified on any shadcn primitive in use.
- No design-export copy exists anywhere in shipped code.
- All visible text audited for sentence case.

Out of scope for Phase 1: homepage sections (hero, stat band, project cards
content, experience table), chat UI, MDX content, deploy/DNS. Those are later
phases / the morning checklist.

---

## 2. Git init

The repo root currently contains only `CLAUDE.md` and `docs/` and is **not**
yet a git repo.

```bash
cd "/path/to/sidhantmathur"     # repo root — contains CLAUDE.md and docs/
git init
git add CLAUDE.md docs
git commit -m "Initial commit: docs and CLAUDE.md"
git checkout -b phase-1-scaffold
```

Do not add a remote or push here — remote wiring (creating
`sidhantmathur/portfolio-v2` on GitHub, archiving the old repo) is a manual
morning task per the build spec's pre-flight checklist, not part of this
phase.

---

## 3. Scaffold procedure

`create-next-app` refuses to scaffold into a non-empty directory, and the
repo root already has `CLAUDE.md` and `docs/`. Scaffold into a temp subfolder
and move the generated files up.

Exact flags:

```bash
npx create-next-app@latest _scaffold-tmp \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --turbopack \
  --use-npm
```

Flag rationale:
- `--typescript --tailwind --eslint --app` — per stack decision (00-decisions
  §6, build-spec §1).
- `--no-src-dir` — keep `app/`, `components/`, `content/`, `lib/` at repo
  root, flat, matching the doc's file-path references throughout.
- `--import-alias "@/*"` — standard, assumed by shadcn's default config.
- `--turbopack` — Next.js 15+ default dev/build tooling; keep unless it
  causes problems, in which case note it in the phase checklist and fall back
  to webpack.
- `--use-npm` — CLAUDE.md doesn't pin a package manager; npm is the safe
  default (matches `npm run build` in the exit criteria).

Move-up procedure (run from repo root):

```bash
# 1. Scaffold into a throwaway subfolder
npx create-next-app@latest _scaffold-tmp --typescript --tailwind --eslint \
  --app --no-src-dir --import-alias "@/*" --turbopack --use-npm

# 2. Move generated files/folders up to repo root, including dotfiles,
#    but do NOT overwrite existing CLAUDE.md or docs/
shopt -s dotglob
for f in _scaffold-tmp/*; do
  base=$(basename "$f")
  if [ "$base" = "docs" ] || [ "$base" = "CLAUDE.md" ]; then
    echo "skip: $base already exists at root"
    continue
  fi
  mv "$f" ./
done
shopt -u dotglob

# 3. Remove the now-empty temp folder
rmdir _scaffold-tmp   # if non-empty, inspect leftovers manually before rm -rf

# 4. Sanity check
ls -la
cat package.json | head -30
```

Notes:
- `create-next-app` will generate its own `.gitignore` and `README.md` — the
  `.gitignore` is fine to move up as-is (append to it later if needed, don't
  replace). Overwrite/discard the generated `README.md` only if the repo
  doesn't already have one worth keeping — it doesn't, so let it move up and
  leave content edits for later (never invent portfolio copy in it).
- Tailwind v4 ships by default with `create-next-app@latest` — there is no
  `tailwind.config.ts` to hand-edit; tokens and theme extensions go in
  `app/globals.css` inside an `@theme` (or `@theme inline`, see §6) block.
  Confirm the generated `package.json` pulls in `tailwindcss@^4` — if it
  scaffolds v3 instead, stop and flag it (decide-at-build-time: pin to v4
  explicitly via `npx create-next-app@latest --tailwind` should already give
  v4 as of the current CLI; re-verify at build time since this drifts).
- After the move, run `npm install` once more from the repo root to confirm
  `node_modules` resolves correctly (the temp folder's `node_modules` does
  not need to be moved — reinstall clean instead of moving it).

---

## 4. shadcn init

Init with radius 0, neutral base color, and generate only what's needed.

```bash
npx shadcn@latest init
```

During the interactive prompts (or via flags if the CLI supports non-interactive
init at build time — check current CLI version):
- Base color: **Neutral**.
- CSS variables: yes (so tokens map through `globals.css`, not inline
  Tailwind classes).
- This creates `components.json`. After init, edit it (or confirm the init
  wizard already set) `"style"` and radius-related config so the effective
  radius is 0. shadcn v4-style `components.json` doesn't store radius
  directly — radius is controlled by the `--radius` CSS variable consumed by
  component classes (e.g. `rounded-lg` → `var(--radius)` chain). Set in
  `globals.css`:

  ```css
  :root {
    --radius: 0rem;
  }
  ```

  Do not leave any `--radius-*` derived value (`--radius-sm`, `--radius-md`,
  etc., if the shadcn init scaffolds them) at a nonzero value — zero the base
  and let the derived ones compute to 0, or set them explicitly to `0rem` if
  they aren't computed.

Component generation — only what Phase 1 actually consumes:

```bash
npx shadcn@latest add button
```

Rationale: 00-decisions §6 says the design is "mostly bespoke primitives"
and lists `button` as the expected/likely-only component. Phase 1 needs a
button for the header/footer area only if used there (it isn't — header is a
mono strip, footer is mono links). The **hero's** "Ask me anything" button is
Phase 2 (homepage), but scaffolding `button` now is reasonable since it's the
one component named explicitly in 00-decisions. Do not run `add` for
`badge`, `card`, or anything else in Phase 1 — evaluate need again in Phase 2
and add only then, one at a time, never a bulk/all install.

---

## 5. Fonts

Use `next/font/google` — zero extra dependencies, self-hosted at build time
(satisfies "no external requests" in the exit criteria).

Create `app/fonts.ts`:

```ts
import { Geist, Geist_Mono } from "next/font/google";

export const geistSans = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist-sans",
  display: "swap",
});

export const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
  display: "swap",
});
```

Wire into `app/layout.tsx` on the `<html>` (or `<body>`) element:

```tsx
import { geistSans, geistMono } from "./fonts";

// <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
```

Tailwind theme mapping (in `globals.css`, see §6) binds the `next/font`
variables (`--font-geist-sans` / `--font-geist-mono`) to Tailwind's
`--font-sans` / `--font-mono` so `font-sans` / `font-mono` utility classes
resolve to Geist. The names must differ between the two layers — mapping
`--font-sans: var(--font-sans)` would be a cyclic custom property and
silently fall back to the browser default.

Weights: only pull 400/500/600/700 for Sans and 400/500 for Mono per
00-decisions §3 — do not pull the full variable-weight range, keep the font
payload minimal.

---

## 6. Design tokens

Put the full token set in `app/globals.css`. This reproduces 00-decisions §2
verbatim plus the Tailwind v4 `@theme inline` mapping and the shadcn variable
mapping.

```css
@import "tailwindcss";

:root {
  color-scheme: light;

  /* Design tokens — 00-decisions.md §2. Do not rename or re-derive. */
  --paper: #FAF7F1;
  --ink: #1B1916;
  --ink-soft: #4A463F;
  --muted: #6E6A62;
  --faint: #9B968C;
  --hairline: #E0DBD1;
  --surface: #F2EEE5;
  --surface-raised: #FFFEFB;
  --band: #131110;
  --band-muted: #97928A;

  --radius: 0rem;

  /* shadcn mapping — 00-decisions.md §2 */
  --background: var(--paper);
  --foreground: var(--ink);
  --muted-foreground: var(--faint);
  --border: var(--hairline);
  --primary: var(--ink);
  --primary-foreground: var(--paper);
}

@theme inline {
  --color-paper: var(--paper);
  --color-ink: var(--ink);
  --color-ink-soft: var(--ink-soft);
  --color-muted: var(--muted);
  --color-faint: var(--faint);
  --color-hairline: var(--hairline);
  --color-surface: var(--surface);
  --color-surface-raised: var(--surface-raised);
  --color-band: var(--band);
  --color-band-muted: var(--band-muted);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);

  --radius: var(--radius);

  /* next/font variables (set on <html> by app/fonts.ts) → Tailwind fonts */
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--paper);
  color: var(--ink);
  /* reference the next/font var directly — @theme inline does not emit
     --font-sans as a runtime custom property */
  font-family: var(--font-geist-sans);
}
```

Notes:
- `color-scheme: light` is set per 00-decisions §6 (dark mode is out of v1,
  signed off by Sidhant 2026-07-03 — do not add a dark variant block).
- Font wiring is two layers with distinct names: `next/font` sets
  `--font-geist-sans` / `--font-geist-mono` on `<html>` (the actual
  font-family + fallback stack); `@theme inline` maps those into Tailwind's
  `--font-sans` / `--font-mono` utilities. Don't hardcode `"Geist",
  sans-serif` strings in CSS — let `next/font` own the family declaration —
  and never map a variable to itself (cyclic → browser default font).
- Delete/replace whatever placeholder tokens `create-next-app`'s default
  `globals.css` scaffolds (the default Tailwind v4 template ships its own
  `--background` / `--foreground` in `@theme inline` referencing
  `oklch(...)` — remove that block entirely and replace with the above).
- No Tailwind `tailwind.config.ts` file should exist or be reintroduced —
  Tailwind v4 config lives in CSS.

---

## 7. Layout primitives

Build these shared components. All are structural/bespoke, not shadcn — base
sizing and behavior precisely on 00-decisions §4.

| File | Purpose |
|---|---|
| `components/layout/container.tsx` | Constrains content to max-width 1200px, horizontal padding 48px desktop, reduced on mobile (e.g. `px-6` mobile → `px-12` desktop via Tailwind responsive classes — exact mobile value is a "decide at build time" per visual QA, default to 24px/`px-6`). |
| `components/layout/section.tsx` | Wraps a page section; renders a 1px `--hairline` top or bottom divider between sections; accepts a prop to swap to a strong `--ink` divider for emphasis cases (e.g. above the dark stat band, or header/footer boundaries) per §4's "strong ink rules for emphasis" note. |
| `components/mono-label.tsx` | Small mono text component for section labels ("Selected work" style) — Geist Mono, 12px, color `--muted`. Sentence case only (source text always from site-copy.md). |
| `components/mono-link.tsx` | Mono 12px link, no underline by default, underline on hover, with a required `variant` prop (`"internal"` → `→` suffix, `"external"` → `↗` suffix). Renders `next/link` for internal, plain `<a target="_blank" rel="noopener noreferrer">` for external. |
| `components/project-card.tsx` | **Skeleton only** — full assembly (image column, metadata strip, real content) is Phase 2. In Phase 1, stub the shell: 1px `--ink` border, sharp corners (radius 0 inherited), numbered corner badge slot (`01`/`02`/`03` — mono 11px, `--ink` background, `--paper` text, absolute top-left), and a placeholder 4-column mono metadata strip region (`role / stack / status / link`, 12px, labels in `--faint`, 1px `--ink` top border, `--hairline` column dividers) with empty/placeholder children. No real card copy goes in here yet — that's Phase 2, sourced from site-copy.md's three project cards. |

Container/Section notes:
- `Container` should be a thin `<div className="mx-auto max-w-[1200px] px-6 md:px-12">` wrapper (adjust breakpoint at build time if visual QA disagrees) — keep it a dumb layout primitive, no business logic.
- `Section` should not hardcode background color — sections like the dark
  stat band (`--band` background, Phase 2) need to override it; make
  background a prop or let the caller wrap `Section` in its own background
  div.

All five files should compile and be importable, but only Header/Footer (§8)
need to actually render real content in Phase 1. `project-card.tsx`,
`mono-label.tsx`, and `mono-link.tsx` can be exercised on a scratch/tokens
preview if useful for visual QA, but no permanent route needs to showcase
them — the dev-server check in §11 just needs header/footer/tokens visibly
correct.

---

## 8. Header & footer

All text quoted verbatim from `site-copy.md`. Never use the design export's
header/footer text (it says "set in Geist — built by hand" and
`hello@sidhantkmathur.com` — neither ships, per 00-decisions §1 and §5).

### Header — `components/layout/header.tsx`

Structure per 00-decisions §4: full-width mono 12px strip, `justify-between`,
14px vertical / 40px horizontal padding (adjust to `Container`'s padding
scale if it conflicts — prefer consistency with `Container`, note the
discrepancy if 40px vs 48px is visually significant), 1px `--ink` bottom
border. Three slots: name · status line · email link.

Text source: site-copy.md → Hero → "Metadata line (mono, small)":

> Sidhant Mathur · Toronto, ON · Open to new roles

This is a single metadata string in the copy doc, but 00-decisions §4
describes the header as three distinct slots (name / status / email link).
**Decide at build time / flag:** site-copy.md does not give the header its
own separate copy block — 00-decisions §5 explicitly says "Hero metadata" →
"Sidhant Mathur · Toronto, ON · Open to new roles" is what ships for the
*header status line*, but doesn't specify separate header name/email-link
strings distinct from that hero metadata line. For Phase 1, render the header
as:
- Left slot: "Sidhant Mathur" (name, taken from the same metadata string).
- Center/status slot: "Toronto, ON · Open to new roles" (remainder of the
  same metadata string).
- Right slot: email link — per 00-decisions §5, no email address exists in
  copy; use `mailto:hello@sidhantmathur.com` per the decisions doc's explicit
  resolution ("point `href` at `mailto:hello@sidhantmathur.com` for Email"),
  with link text "Email" (mono link style, `mono-link.tsx`, external-style
  since it's a `mailto:` — use the `↗`-suffix variant or a no-suffix mailto
  special case; pick one and stay consistent — recommend no suffix for
  `mailto:` since it's not a page navigation).

Flag: this three-way split of one metadata line is an inference, not
explicit in either source doc — reasonable given the layout pattern, but
confirm during visual QA / sign-off rather than treating as settled.

### Footer — `components/layout/footer.tsx`

Structure per 00-decisions §4: mono 11px in `--faint`, hairline top border,
`justify-between`.

Text source: site-copy.md → "Small pieces" → Footer line:

> © 2026 Sidhant Mathur · Toronto, ON · GitHub · LinkedIn · Email

Render as mono 11px text with "GitHub", "LinkedIn", "Email" as individual
`mono-link.tsx` links (external variant, `↗` suffix) with real hrefs per
00-decisions §5/§11 (resolved from the resume source):
- GitHub → `https://github.com/sidhantmathur`
- LinkedIn → `https://www.linkedin.com/in/sidhantmathur`
- Email → `mailto:hello@sidhantmathur.com`

(The *colophon's* link to this portfolio's own repo is separate and still
gated on the `[TODO: confirm repo is public before linking]` marker — that
one stays unresolved.)

---

## 9. Asset extraction

Extract the embedded A Darle 20 screenshot from the design export. Run from
the repo root (requires `docs/Sidhant Mathur - Portfolio.html` to exist,
which it does):

```bash
node -e "
const fs=require('fs');
const html=fs.readFileSync('docs/Sidhant Mathur - Portfolio.html','utf8');
const m=html.match(/<script type=\"__bundler\/manifest\"[^>]*>([\s\S]*?)<\/script>/);
const manifest=JSON.parse(m[1]);
const img=manifest['7e8dbf91-728e-4858-aab8-294dce5ace8e'];
fs.mkdirSync('public/images',{recursive:true});
fs.writeFileSync('public/images/adarle20-listings.png', Buffer.from(img.data,'base64'));
"
```

Verify after running: `public/images/adarle20-listings.png` exists and is
roughly ~1.2MB (per 00-decisions §7). This image is not used by anything in
Phase 1 (project card content/image column is Phase 2) — extraction just
needs to happen once and be committed so Phase 2 doesn't depend on the design
export file being present. Optimization via `next/image` happens where the
image is actually rendered, in Phase 2.

---

## 10. `.env.example`

Create at repo root, contents per 00-decisions §9:

```
AI_GATEWAY_API_KEY=          # chat works without it only in error-state form
UPSTASH_REDIS_REST_URL=      # optional locally (in-memory fallback)
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_POSTHOG_KEY=     # optional; analytics off when empty
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Confirm `.gitignore` (generated by `create-next-app`) already ignores
`.env*.local` — it does by default. Do not create `.env.local` in this
phase; no Phase 1 code reads these vars yet (chat route is Phase 2/3).

---

## 11. Phase checklist

- [ ] `git init` done; initial commit of `CLAUDE.md` + `docs/`; branch
      `phase-1-scaffold` checked out.
- [ ] Next.js app scaffolded at repo root (not nested in a subfolder); temp
      scaffold folder removed; `CLAUDE.md` and `docs/` untouched/unmoved.
- [ ] `package.json` confirms Tailwind v4; no `tailwind.config.ts` present.
- [ ] `npm run build` passes with zero errors.
- [ ] `npm run dev` renders a page showing the global header and footer with
      real tokens (paper background, ink text, mono strips) — not default
      `create-next-app` boilerplate.
- [ ] Fonts load locally: confirm in devtools network tab that Geist/Geist
      Mono woff2 files are served from the Next.js origin, not
      `fonts.googleapis.com` / `fonts.gstatic.com` (no external requests at
      runtime).
- [ ] `--radius: 0` verified: inspect the generated `button` component (or
      any shadcn primitive) in devtools — computed `border-radius` is `0px`.
- [ ] shadcn `components.json` present; only `button` generated — no other
      components installed.
- [ ] `app/globals.css` contains the full token table from 00-decisions §2,
      the shadcn variable mapping, and `color-scheme: light`. No leftover
      default Tailwind v4 `oklch(...)` tokens.
- [ ] Layout primitives exist and compile: `components/layout/container.tsx`,
      `components/layout/section.tsx`, `components/mono-label.tsx`,
      `components/mono-link.tsx`, `components/project-card.tsx` (skeleton).
- [ ] Header renders: name / status / email slots, mono 12px, 1px ink bottom
      border, text sourced from site-copy.md hero metadata line (see §8 flag
      on the three-way split).
- [ ] Footer renders: exact text "© 2026 Sidhant Mathur · Toronto, ON ·
      GitHub · LinkedIn · Email" (site-copy.md → Small pieces), mono 11px,
      `--faint`, hairline top border. Hrefs: github.com/sidhantmathur,
      linkedin.com/in/sidhantmathur, `mailto:hello@sidhantmathur.com`.
- [ ] `public/images/adarle20-listings.png` extracted and committed.
- [ ] `.env.example` created at repo root with the five vars from
      00-decisions §9; `.env.local` confirmed git-ignored (not created).
- [ ] Sentence case audit: every string rendered on screen in this phase
      (header, footer, any placeholder text) is sentence case, no
      `text-transform: uppercase` anywhere in the CSS added this phase.
- [ ] No design-export text anywhere in shipped code — grep the diff for
      strings like "hello@sidhantkmathur.com", "set in Geist", "104 games",
      "290 players", "CTO / cofounder" to confirm none leaked in.

---

## Conflicts / uncertainties flagged (not resolved here)

1. **Header three-way text split** (§8): 00-decisions §4 describes the
   header as three slots (name · status line · email link), but
   00-decisions §5 and site-copy.md only supply one combined metadata string
   ("Sidhant Mathur · Toronto, ON · Open to new roles") plus a separate,
   unaddressed email-link requirement. The split into name/status/email used
   above is an inference to satisfy the layout pattern — flag for sign-off.
2. **`mailto:` link suffix convention**: 00-decisions §3 defines `→`
   (internal) / `↗` (external) suffixes for mono links generally, but doesn't
   address `mailto:` links specifically. This doc picks "no suffix for
   mailto" as a default — confirm or override at build time.
3. **Header padding**: 00-decisions §4 states header padding as "14px/40px",
   while the general layout padding (§4, container) is 48px desktop. Left
   as-is (40px for header specifically, per the explicit header spec) but
   flagged since it's an intentional-looking inconsistency worth double
   checking wasn't a typo in the source doc.
4. **Mobile container padding value**: 00-decisions §4 says "48px (less on
   mobile)" without pinning an exact mobile number. This doc defaults to 24px
   / Tailwind `px-6` — treat as provisional, adjust freely during visual QA.
5. **Tailwind v4 vendoring via `create-next-app@latest`**: assumed current as
   of today, but CLI defaults drift — re-verify `package.json` after
   scaffolding rather than trusting this doc blindly.
