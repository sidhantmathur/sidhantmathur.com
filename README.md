# sidhantmathur.com

Personal portfolio. Static Next.js site (App Router) with one AI chat endpoint
(`/api/chat`) backed by Claude via the Vercel AI Gateway.

## Local viewing

```
npm install
cp .env.example .env.local   # can stay empty — the site runs without keys
npm run dev                  # http://localhost:3000
```

With an empty `.env.local`: every page renders, and the chat UI renders and
shows the copy's error state when a message is sent. With `AI_GATEWAY_API_KEY`
set: chat streams answers (rate limiting uses an in-memory fallback until the
Upstash keys exist).

This working copy lives in WSL. Run `npm install` / `npm run dev` **inside WSL**
(`wsl -e bash -lc "cd ~/sidhantmathur && npm run dev"`) — npm and file-watching
over the Windows UNC bridge are slow and flaky.

## Commands

- `npm run dev` — dev server (runs `build-knowledge` first via `predev`)
- `npm run build` — production build (runs `build-knowledge` first via `prebuild`)
- `npm run start` — serve the production build
- `npm run lint` — ESLint

The chat knowledge base is generated at build time from
`content/knowledge/*.md` into `lib/knowledge.generated.ts` (git-ignored) by
`scripts/build-knowledge.mjs`.

## Deployment

Deployment, keys, and account setup are deferred to the morning checklist in
[`docs/implementation-plan/README.md`](docs/implementation-plan/README.md)
(Vercel + AI Gateway, Upstash, PostHog, GitHub, domain, prod verification).
`docs/implementation-plan/00-decisions.md` is the authoritative architecture
and design reference.
