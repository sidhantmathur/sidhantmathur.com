# Implementation plan — sidhantkmathur.com

End-to-end plan to build the portfolio overnight so it is **code-complete and
viewable locally**, with all human/deployment work deferred to a morning
checklist. Written 2026-07-03.

## Reading order

| File | What it covers |
|---|---|
| [00-decisions.md](00-decisions.md) | Design tokens, copy-vs-design conflict resolutions, pinned architecture decisions. **Read first — every phase depends on it.** |
| [01-scaffold-and-design-system.md](01-scaffold-and-design-system.md) | Phase 1: repo/git init, Next.js scaffold, Tailwind + shadcn (radius 0), fonts, tokens, layout primitives, header/footer, asset extraction |
| [02-static-pages.md](02-static-pages.md) | Phase 2: homepage, three case studies, resume + /resume.md, colophon, 404, /llms.txt, MDX pipeline, OG image |
| [03-chat.md](03-chat.md) | Phase 3: knowledge base build, `/api/chat`, guardrails, rate limiting, sticky chat bar + `/chat` page, PostHog events |
| [04-generative-ui-and-verification.md](04-generative-ui-and-verification.md) | Phase 4: chat tools (showProject / showResume / roleFit / contactCard), eval lists, verification pass, Lighthouse, definition of done |

## Ground rules (apply to every phase)

- `docs/site-copy.md` is the only source of site text. Verbatim, sentence case,
  `[TODO]` markers stay visible. The design export's text never ships.
- Static-first: `POST /api/chat` is the only server route.
- No dependencies beyond the list in 00-decisions §6.
- No secrets in the repo; `.env.example` documents every variable.
- **Gate at the end of every phase: `npm run build` passes with zero errors**
  and the phase's own checklist is green. Do not start the next phase on a red
  build.
- Git: init at the start of Phase 1; one feature branch per phase
  (`phase-1-scaffold`, …), atomic commits, merge to `main` at each green gate.
  Remote/GitHub wiring happens in the morning.

## Local viewing (the overnight deliverable)

```
npm install
cp .env.example .env.local   # can stay empty — site must run without keys
npm run dev                  # http://localhost:3000
```

With an empty `.env.local`: every page renders, chat UI renders and shows the
copy's error state when a message is sent. With `AI_GATEWAY_API_KEY` set: chat
streams answers (rate limiting uses the in-memory fallback until Upstash keys
exist).

Note for this machine: the working copy lives in WSL
(`\\wsl.localhost\ubuntu\home\sidhant\sidhantmathur`). Run `npm install` /
`npm run dev` **inside WSL** (`wsl -e bash -lc "cd ~/sidhantmathur && npm run dev"`)
— npm and file-watching over the Windows UNC bridge are slow and flaky.

## Execution model

Each phase is sized for one focused Claude Code session. Mechanical work
(page assembly from copy, MDX transcription, boilerplate) can be delegated to
subagents; the orchestrator verifies every phase gate against
`docs/portfolio-build-spec.md`, `docs/site-copy.md`, and 00-decisions before
moving on.

When an API's current shape is uncertain (Next.js 15/16, AI SDK v4 vs v5,
shadcn CLI flags, Tailwind v4 syntax), check the context7 MCP docs tools
rather than guessing from training data — the phase docs flag the known
version traps but the installed versions win.

## Morning checklist (human work, in order)

Deployment and account tasks deliberately left out of the overnight build:

1. **Sign-offs** (most decided by Sidhant 2026-07-03 — dark mode skipped,
   ⌘K palette approved via shadcn `command`, cover-letter requests declined,
   experience table built from the resume source): remaining items — sticky
   chat bar replaces floating launcher; About lives on the homepage (order:
   Selected work → chat teaser → About); **phone number excluded from all
   web-published resume surfaces** (00-decisions §11).
2. **Fill `[TODO]`s in `docs/site-copy.md`** (A Darle 20 numbers, resume
   last-updated date — suggested "July 2026"), then re-sync the affected
   pages/knowledge files. Also fill faq.md's "what he's NOT looking for".
3. **Files**: export `resume.pdf` from
   `docs/resume/Sidhant_Mathur_Resume_GTM.docx` into `public/`; confirm
   portfolio repo public or not before linking it from the colophon.
   (GitHub/LinkedIn URLs and email are already resolved from the resume —
   00-decisions §5.)
4. **Vercel**: create project, enable AI Gateway, **set $10 CAD monthly
   budget**, generate `AI_GATEWAY_API_KEY`, add all env vars in the dashboard.
5. **Upstash**: create Redis via Vercel Marketplace free tier; add REST
   URL/token envs (local + Vercel).
6. **PostHog**: decide separate project vs. existing Adarle20 org project;
   set `NEXT_PUBLIC_POSTHOG_KEY`.
7. **GitHub**: create `sidhantmathur/portfolio-v2`, push, archive the old repo
   (don't delete).
8. **Domain**: check sidhantkmathur.com registration/renewal, remove stale
   Gatsby Cloud/Netlify DNS records, point DNS at Vercel.
9. **Verify in prod**: run the Phase 4 checklist against the deployed site
   (rate-limit script, OG image paste test in LinkedIn/Slack, Lighthouse ≥95,
   replace old Google Drive resume links everywhere with /resume).

## Out of scope for v1 (tracked, not built)

- `/now` page (optional in spec; no copy exists).
- Dark mode toggle (no dark tokens in the design — signed off).
- Resend contact form (spec marks it optional phase 2; Sidhant already has a
  Resend Pro account, so only copy + a small form stand between v1 and this
  when wanted).
- Blog / content flywheel (spec Phase 4).
