# Launch checklist — sidhantmathur.com

Human tasks to take the site from code-complete to live. Written 2026-07-03,
supersedes the "morning checklist" in `docs/implementation-plan/README.md`
(items already done are dropped; domain plan changed — see below).

State as of writing: all four build phases merged to `main`, build green.
Domain **sidhantmathur.com bought at Cloudflare 2026-07-03** and made
canonical throughout the codebase (old sidhantkmathur.com is stuck on a
Squarespace clientHold — registered until June 2027, rescue is non-urgent).
Site email is now **hello@sidhantmathur.com** everywhere.

Items marked **[→ Claude]** are ready to hand back to an agent once the
human input exists.

## A. Email (do first — launch blocker)

The site, chatbot, and resume all show hello@sidhantmathur.com. Until
forwarding exists, mail to it bounces.

- [ ] Cloudflare dashboard → sidhantmathur.com → Email → Email Routing →
      create custom address `hello@` → destination: personal Gmail inbox →
      click the verification link that lands in Gmail. Cloudflare adds the
      MX/SPF records itself. (~5 min, free)
- [ ] Send a test email to hello@sidhantmathur.com and confirm it arrives.
- [ ] This week, sending as hello@: verify sidhantmathur.com in the Resend
      dashboard (add the DKIM/SPF records it gives you in Cloudflare DNS),
      then Gmail → Settings → Accounts → "Send mail as" → add
      hello@sidhantmathur.com with SMTP `smtp.resend.com`, port 465,
      username `resend`, password = a Resend API key. Set as default; tick
      "reply from the same address the message was sent to".

## B. Copy inputs (give these to Claude, ~15 min of thinking)

- [ ] One or two concrete A Darle 20 outcome numbers (fills the visible
      `[TODO]` in `content/adarle20.mdx` + the knowledge file). **[→ Claude]**
- [ ] Resume "last updated" month/year — suggested "July 2026" (fills
      `/resume` page + chat resume card). **[→ Claude]**
- [ ] FAQ "what he's NOT looking for" (`content/knowledge/faq.md`). **[→ Claude]**
- [ ] Decide: is this repo public? (colophon either links it or drops the
      line). **[→ Claude]**
- [ ] Export `resume.pdf` from `docs/resume/Sidhant_Mathur_Resume_GTM.docx`
      into `public/`. Update the docx contact line first to
      hello@sidhantmathur.com · sidhantmathur.com so PDF and site match.
      No phone number on the web version.

## C. Design sign-offs (decisions only you can make)

- [x] Faint-ink contrast — **done, no decision needed.** The contrast
      overhaul raised every ink and line token by lightness alone (hue and
      chroma held), so the palette got brighter rather than grayer:
      `--text-soft` #A9A29A → #C4BCB4 (7.84 → 10.55:1), `--text-faint`
      #6B655E → #97918A (3.44 → 6.34:1), `--line-strong` #332E29 → #645C53
      → #6B6259 (1.47 → 3.01 → 3.31:1 on `--bg`, and 3.18 on `--panel` /
      3.03 on `--raised` — the second lift came from measuring it against
      the surfaces the bordered controls actually sit on, where #645C53 was
      2.89 and 2.75 and under the 3:1 non-text floor; this is also what
      makes the link underlines visible), `--line` #231F1C → #2C2825. The mobile
      backdrop scrim went 55% → 78% so faint text over the brightest patch
      of texture still clears 4.5:1. Every reading colour is now AA or
      better; the one sub-AA token left is `--text-dim` (#6B655E, 3.44:1),
      which is disabled-state and decoration only and never carries content.
- [ ] `/chat` mobile Lighthouse is 91–93 (desktop 100). Accept, or budget a
      lazy-load follow-up. **[→ Claude if changing]**
- [ ] Browser QA pass: console clean, ⌘K palette, sticky bar → /chat
      handoff, and the stat band (giant "4–6" with the caption; "hours per
      day" deliberately not next to the number — confirm intended).

## D. GitHub (~10 min)

- [ ] Create `sidhantmathur/portfolio-v2`, push `main` + phase branches.
      **[→ Claude can push once the remote exists]**
- [ ] Archive (don't delete) the old portfolio repo.

## E. Vercel (~30 min, order matters)

- [ ] Import the GitHub repo as a new project (Next.js auto-detected,
      default settings fine).
- [ ] Enable AI Gateway on the account; **set the $10 CAD monthly budget**
      (this is the chatbot cost kill switch).
- [ ] Create an `AI_GATEWAY_API_KEY`; add it to the Vercel project env vars
      AND to local `.env` (Claude needs it to run the eval suite).
- [ ] Storage → Marketplace → add **Upstash Redis** (free tier); it injects
      `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` automatically.
- [ ] PostHog: create a **separate project** (same Adarle 20 org) for the
      portfolio; set `NEXT_PUBLIC_POSTHOG_KEY` in Vercel env vars
      (`NEXT_PUBLIC_POSTHOG_HOST` stays https://us.i.posthog.com).
- [ ] Confirm all four vars from `.env.example` are present in Vercel.

## F. DNS (~10 min + propagation)

- [ ] Cloudflare DNS for sidhantmathur.com: `A @ 76.76.21.21` and
      `CNAME www cname.vercel-dns.com`, both set to **DNS only** (grey
      cloud, not proxied — Vercel handles SSL/CDN itself).
- [ ] Vercel project → Settings → Domains: add sidhantmathur.com and
      www.sidhantmathur.com; set www → apex redirect.

## G. Verify in prod (after D–F)

- [ ] **[→ Claude]** Run the eval suite locally against /chat (20 recruiter
      questions + 11 adversarial prompts, needs the gateway key, ~10 min).
- [ ] **[→ Claude]** Prod checks: rate-limit script against the live
      endpoint, Lighthouse ≥ 95, resume download works.
- [ ] OG image paste test: drop sidhantmathur.com into LinkedIn/Slack
      composer, confirm the card renders.
- [ ] Update LinkedIn contact email + replace old Google Drive resume links
      everywhere with sidhantmathur.com/resume.

## H. Old domain rescue (non-urgent — registered until June 2027)

- [ ] Recover the Squarespace account (login email may be stale — use
      account recovery); update contact email + payment card.
- [ ] Clear the clientHold: likely the ICANN email-verification banner in
      the domains dashboard, else Squarespace support ("domain is on
      clientHold, what's needed?"). Hold applied ~2026-06-28.
- [ ] Once lifted: transfer sidhantkmathur.com to Cloudflare (unlock →
      EPP code → initiate at Cloudflare, ~$10.44 USD, adds a year to the
      2027 expiry).
- [ ] 301-redirect it to sidhantmathur.com (simplest: add the old domain to
      the Vercel project and mark it "redirect to sidhantmathur.com").

## Later (tracked, not blocking)

- Resend contact form (Resend Pro already paid; copy + small form).
- `/now` page, dark mode, blog — out of scope for v1 by decision.
