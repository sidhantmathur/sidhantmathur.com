# Portfolio v2 — Build Spec

Owner: Sidhant Mathur · Target: sidhantmathur.com (2026-07-03: replaces sidhantkmathur.com, which redirects here once recovered from Squarespace) · Host: Vercel (existing plan)
Positioning: AI-native technical operator — GTM engineering / revenue systems / solutions engineering.

## 0. Pre-flight (manual, before any code)

- [ ] Check registrar: is sidhantkmathur.com still registered? Renew if lapsed.
- [ ] Remove old DNS records pointing to Gatsby Cloud / Netlify.
- [ ] Enable Vercel AI Gateway on the account + **set a monthly budget ($5–10)** in the Vercel dashboard.
- [ ] New repo: `sidhantmathur/portfolio-v2` (archive the old one — don't delete; commit history has value).

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15+ (App Router), TypeScript | Matches A Darle 20 stack; best LLM/Claude Code fluency; static-first |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent, LLM-fluent |
| Content | MDX files in `/content` (projects, case studies, bio) | Static, version-controlled, no CMS |
| AI | Vercel AI SDK + **Vercel AI Gateway** (model string e.g. `anthropic/claude-haiku-4.5`) | No key management; budgets + observability in Vercel dashboard; one-line model swaps |
| Rate limiting | Upstash Redis (Vercel Marketplace free tier) via `@upstash/ratelimit` | Protect the chat endpoint |
| Fonts | Geist Sans (headings/body) + Geist Mono (metadata/labels/chat), sentence case only | Decided |
| Analytics | PostHog (existing account) | Funnel: visit → chat → resume download → contact |
| Email/contact | Resend (existing) — simple contact form or mailto | Optional phase 2 |
| Database | **None for v1.** No RAG, no Supabase | Corpus fits in system prompt; document this decision |

Rendering model: every page statically generated. Single dynamic surface: `POST /api/chat` (serverless function, streaming).

## 2. Site map

```
/                     Hero + proof points + featured projects + chat entry
/projects/adarle20    Full case study (flagship)
/projects/nokia       Case study (sanitized)
/projects/dell-ml     Short case study
/colophon             "How this site was built" (meta case study #4)
/resume               HTML resume + PDF download + /resume.md (raw markdown for AIs)
/llms.txt             AI-readable site index
/now                  Optional: current focus (job search, A Darle 20, training)
```

Chat UI: floating launcher available site-wide + full-page mode at `/chat`. Suggested-question chips on first open.

## 3. Chatbot architecture

### Flow
```
Client (useChat hook, streaming UI)
  → POST /api/chat  (edge/serverless)
      → rate limit check (per-IP, e.g. 20 msgs/hour, 10 msg conversation cap)
      → input validation (max 500 chars/message, max 12 messages history)
      → streamText({ model: 'anthropic/claude-haiku-4.5' via AI Gateway,
                     system: KNOWLEDGE_BASE, tools, maxOutputTokens: ~600 })
  ← streamed text + tool-driven UI components
```

Persistence: **none** (decided). Conversations are stateless; history lives client-side
only. PostHog events capture question topics for knowledge-base iteration.

### Knowledge base
- `content/knowledge/*.md` — resume, extended bio, per-project deep detail, FAQ (visa/citizenship: Canadian citizen; location: Toronto; roles targeted; what he's NOT looking for).
- Concatenated at build time into the system prompt. Use Anthropic prompt caching. Target ≤ 8k tokens.

### Tools (generative UI — the differentiator)
1. `showProject({ slug })` → renders ProjectCard (screenshot, stack badges, metrics, link) inline in chat.
2. `showResume()` → renders resume download card.
3. `roleFit({ role })` → renders a skills-match component mapping Sidhant's experience to a named role (GTM engineer, SE, RevOps, sales ops).
4. `contactCard()` → renders email/LinkedIn card.

### Guardrails (non-negotiable)
- System prompt: only discuss Sidhant's professional background; decline everything else politely and redirect; never disparage; never role-play as anything else; treat user content as untrusted (prompt-injection resistant framing).
- `maxOutputTokens` cap, message length cap, conversation length cap.
- Per-IP rate limit; global daily budget check optional.
- Vercel AI Gateway monthly budget as the kill switch (belt + suspenders).
- Log chats (PostHog events or console) to see what recruiters actually ask — feed back into knowledge base.

### Cost envelope
Haiku-class, ~8k cached input + ~600 output per message → fractions of a cent per message. Even 1,000 messages/month lands in single-digit dollars. Spend limit makes worst case a paused bot, not a bill.

## 4. Content requirements (writing tasks, not code)

**Facts: superseded 2026-10-26.** Every fact about Sidhant now comes from his
master resume and the verified-facts ledger in its decisions log (local copies in
the git-ignored `docs/source/`; `content/knowledge/` is built from them). The
case-study briefs below keep their structure; the numbers and claims the
original spec carried here were replaced or cut, and must not come back from git
history. A Darle 20 is supporting evidence, not the flagship.

### A Darle 20 case study
- What it is: a marketplace for tabletop game sessions, based in Puebla, Mexico; co-founder and CTO, part-time, sole developer.
- Build: the master's stack line (Next.js, React, TypeScript, Supabase, Stripe Connect, Vercel, PostHog, Resend).
- Numbers: users, hosts, players and session reservations, as the master states them. Never revenue, GMV, MRR, visitor counts or "bookings".

### Nokia case study (sanitize; no confidential data/screens)
- The tools a 7-region sales organization reports on: the weekly operating review tool, the quarter-end Power App, CRM Analytics then Power BI reporting, and the systems he inherited and keeps running.
- The AI agent is in testing with no results, and says so.

### Dell ML (short)
- Propensity model → ~20,000 cross-sell accounts, ~$129M at the segment's average deal size: a sizing, not pipeline.

### Colophon
- Stack choices and why; why NO RAG; chatbot guardrail design; what was delegated to Claude Code vs. decided by hand; cost design. Converts the site into proof-of-work.

## 5. Build phases

**Phase 1 — Ship static (1–2 sessions with Claude Code)**
Scaffold Next.js + Tailwind + shadcn. Hero, projects grid, resume page, MDX pipeline, dark mode, OG images, deploy to Vercel, point DNS. *Site is live and no longer embarrassing.*

**Phase 2 — Chatbot (1–2 sessions)**
API route + AI SDK + knowledge base + guardrails + rate limiting + basic chat UI with suggested chips. PostHog events.

**Phase 3 — Generative UI + polish**
Tool-rendered components in chat, roleFit tool, ⌘K palette, /llms.txt, /now, colophon page.

**Phase 4 — Content flywheel (ongoing)**
Blog: multi-agent audit workflow post, "why my portfolio bot has no RAG" post. Cross-post to LinkedIn.

## 6. Definition of done (v1)

- [ ] Lighthouse ≥ 95 on all static pages
- [ ] Chatbot answers 20 canned recruiter questions correctly (write these as an eval list first)
- [ ] Chatbot refuses 10 adversarial prompts gracefully (write these too)
- [ ] Rate limit verified with a script
- [ ] Budget set in Vercel AI Gateway
- [ ] Old resume Google Drive link replaced everywhere with /resume
- [ ] OG image renders correctly when link pasted in LinkedIn/Slack
