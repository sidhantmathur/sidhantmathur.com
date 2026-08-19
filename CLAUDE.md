# CLAUDE.md — sidhantmathur.com

Personal portfolio. Static Next.js site with one AI chat endpoint.

## Stack
Next.js (App Router) + TypeScript + Tailwind + shadcn/ui (radius 0) · Geist Sans/Mono
Chat: Vercel AI SDK via Vercel AI Gateway · Rate limiting: Upstash · Analytics: PostHog

## Sources of truth — read before building, never contradict
- `docs/portfolio-build-spec.md` — architecture, phases, chatbot design
- `docs/site-copy.md` — ALL site text. Draft copy is allowed (see Copy below); `[TODO]` markers stay visible.
- `docs/` design files — tokens and visual direction

## What to build next
- `docs/roadmap.md` — **the build order.** Seven sequential sprints plus a parallel
  copy-gated track, with acceptance criteria per sprint. Start here; it tells you
  what to read next. Track A sprints contend for `app/api/chat/route.ts` and
  `components/shell/app-shell.tsx` — don't run two at once.
- `docs/idea-decisions.md` — **the decided feature list** (28 items), what was
  rejected and why, and four standing design policies. Read this before planning
  any new feature. Items are numbered; refer to them by number.
- `docs/idea-bank.md` — the raw brainstorm archive. Superseded by the decisions
  doc **except §6**, the job-description roadmap, which is live and unreviewed and
  is the only spec for that work.
- `docs/mockups/` — rendered explorations referenced by the decisions doc.
- Plan one cluster at a time, when you're about to build it. The list has real
  dependencies and a plan-everything document would be stale before it shipped.

## Rules
- Sentence case everywhere. No all-caps text, no tactical/military-flavored language, even if a design export contains it.
- Static-first: every page pre-rendered; the only server route is `/api/chat`.
- New dependencies are fine when they solve a real problem better than hand-rolling
  (PDF/docx generation, compression). Say what you added and why. New *services*
  still need asking.
- Never commit secrets; env vars via Vercel only.
- `npm run build` must pass with zero errors before any task is "done".

## Cloud dev
Most work happens in a cloud sandbox now. Setup is `npm ci && npx playwright install
chromium` — no services, no Docker. `npm run build` itself needs no network (fonts come
from the `geist` package, not Google, and `scripts/build-measurements.mjs` treats missing
credentials as a normal path); the Chromium download does, from `cdn.playwright.dev`.

Keys are optional. Add `AI_GATEWAY_API_KEY` only when touching chat or live evals; without
it `/api/chat` returns its error state and everything else is unaffected. Upstash and
PostHog vars have working fallbacks.

**Seeing the site** — do not claim a visual change works without looking at it:
- `npm run shot` for local headless screenshots; read the PNGs, and send them to Sidhant
  for approval when the change is visual.
- Or push the branch and screenshot the Vercel preview with `BASE=https://…`. Preview
  deployment protection has to be off or bypassed for that to work headless.

Not available in a cloud sandbox: authenticated MCP connectors (PostHog, Vercel) and
`npm run eval:live`. Push from the sandbox; let Vercel's GitHub integration deploy.

## Copy
Draft placeholder copy freely so pages can be seen whole — empty `[TODO]` markers
hide what the site actually looks like. Two hard conditions:

1. **Log every drafted string in `docs/copy-ledger.md`** — file, what it says, and
   whether it makes a factual claim. Nothing ships to Sidhant's review unlogged.
2. **Never invent facts about Sidhant.** Employers, dates, titles, metrics, tools,
   outcomes, and anything a hiring manager could check must come from
   `content/knowledge/` or the resume. If a sentence needs a fact you don't have,
   write the sentence and mark the fact `[VERIFY]` — do not guess a plausible one.

Voice-and-tone drafting is yours. Claims about his experience are not.

## Git
Feature branches for multi-step work; atomic commits with clear messages.

## Commands
Native Ubuntu — run directly from the repo root (the old WSL wrapper is gone).
- `npm run dev` — dev server at http://localhost:3000 (`predev` regenerates the knowledge base)
- `npm run build` — production build (`prebuild` regenerates the knowledge base); must pass with zero errors
- `npm run start` — serve the production build
- `npm run lint` — ESLint
- `npm run shot -- / /resume` — headless screenshots to `.screenshots/` (add `--mobile`, `--full`;
  point at a deploy with `BASE=https://…`). Needs `npx playwright install chromium` once per machine.

The chat knowledge base is built from `content/knowledge/*.md` by `scripts/build-knowledge.mjs`, wired as `predev`/`prebuild`. It writes two git-ignored files: `lib/knowledge.generated.ts` (the prompt text) and `lib/chunks.generated.ts` (the same content as addressable chunks — the ids the model cites and `lib/verify.ts` checks against).

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root (created lazily). See `docs/agents/domain.md`.
