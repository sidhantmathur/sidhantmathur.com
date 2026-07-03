# CLAUDE.md — sidhantkmathur.com

Personal portfolio. Static Next.js site with one AI chat endpoint.

## Stack
Next.js (App Router) + TypeScript + Tailwind + shadcn/ui (radius 0) · Geist Sans/Mono
Chat: Vercel AI SDK via Vercel AI Gateway · Rate limiting: Upstash · Analytics: PostHog

## Sources of truth — read before building, never contradict
- `docs/portfolio-build-spec.md` — architecture, phases, chatbot design
- `docs/site-copy.md` — ALL site text. Never write, edit, or "improve" copy. `[TODO]` markers stay visible.
- `docs/` design files — tokens and visual direction

## Rules
- Sentence case everywhere. No all-caps text, no tactical/military-flavored language, even if a design export contains it.
- Static-first: every page pre-rendered; the only server route is `/api/chat`.
- No new dependencies or services without asking.
- Never commit secrets; env vars via Vercel only.
- `npm run build` must pass with zero errors before any task is "done".

## Git
Feature branches for multi-step work; atomic commits with clear messages.

## Commands
(fill in after scaffold: dev / build / lint)
