# Summary fix for the canonical resume

**Applied 2026-10-22 at Sidhant's word** to all four places listed below. The PDF
is now generated: the `canonical` variant in `build.py`. This file stays as the
record of what changed and why.

## What's wrong with the current one

1. **It blends two roles.** "3+ years owning sales reporting, forecasting, and
   quarter-end close infrastructure" puts all three under one span. Forecasting was
   the workforce management role (Oct 2022 – Jun 2024). Sales reporting and the
   quarter-end tool are the sales operations role (Jun 2024 – present, a little over
   two years). Only "3+ years at Nokia" is true as a single span.
2. **It blends two tools.** "(150+ users across 7 regions)" joins the Power BI
   migration's user count (150+) to the Power App's reach (80+ stakeholders across
   7 regions). No single tool had 150+ users across 7 regions.
3. **"AI-native revenue operations builder" reads as a slogan.** His title is the
   stronger lead, and the AI claim is backed later in the paragraph by what he
   actually does (Claude Code).
4. **"Looking for a RevOps / GTM systems role"** leaves out delivery operations,
   which he now targets too (`content/knowledge/faq.md`).

## Proposed text

> Sales operations specialist who turns ambiguous business problems into shipped
> software. 3+ years at Nokia: headcount reporting and forecasting for a
> 3,000–4,000-person organization, then sales reporting for 150+ users and a
> quarterly executive reporting app used by 80+ stakeholders across 7 regions.
> Co-Founder & CTO of A Darle 20, a live two-sided marketplace with 1,400+ users
> and 2,100+ bookings, architected and shipped solo with an AI-agent-heavy
> development workflow (Claude Code). Looking for a revenue operations or delivery
> operations role at an AI-forward company.

Every number and claim is already in the resume's own bullets. Nothing is new.

## Minimal diff (`docs/resume/resume-source.md`)

```diff
 ### Summary

-AI-native revenue operations builder who turns ambiguous business problems into
-shipped software. 3+ years owning sales reporting, forecasting, and
-quarter-end close infrastructure for global sales and finance teams at Nokia
-(150+ users across 7 regions). Co-Founder & CTO of A Darle 20, a live
-two-sided marketplace with 1,400+ users and 2,100+ bookings, architected and
-shipped solo with an AI-agent-heavy development workflow. Looking for a
-RevOps / GTM systems role at an AI-forward company.
+Sales operations specialist who turns ambiguous business problems into shipped
+software. 3+ years at Nokia: headcount reporting and forecasting for a
+3,000–4,000-person organization, then sales reporting for 150+ users and a
+quarterly executive reporting app used by 80+ stakeholders across 7 regions.
+Co-Founder & CTO of A Darle 20, a live two-sided marketplace with 1,400+ users
+and 2,100+ bookings, architected and shipped solo with an AI-agent-heavy
+development workflow (Claude Code). Looking for a revenue operations or delivery
+operations role at an AI-forward company.
```

Word by word, the changes are:

- `AI-native revenue operations builder` → `Sales operations specialist` (his title).
- `3+ years owning sales reporting, forecasting, and quarter-end close
  infrastructure for global sales and finance teams at Nokia (150+ users across 7
  regions)` → `3+ years at Nokia:` followed by each role's work, each with its own
  number.
- `development workflow.` → `development workflow (Claude Code).`
- `RevOps / GTM systems role` → `revenue operations or delivery operations role`.

## Where to paste it

The summary lives in four places, which have to stay identical:

1. `docs/resume/resume-source.md`, under "Summary".
2. `content/knowledge/resume.md`, under "## Summary". The chat answers from this
   file.
3. `app/resume/page.tsx`, the `<p>` under `<MonoLabel>Summary</MonoLabel>`.
   Write `&` as `&amp;` there.
4. `public/resume.pdf`. Re-export it. It's a LibreOffice export, and it is **not**
   made from `docs/resume/Sidhant_Mathur_Resume_GTM.docx` (see README, "Found on
   the way").

After pasting, run the static tests:
`node scripts/build-knowledge.mjs && node scripts/build-repo-corpus.mjs && node --test --experimental-strip-types "evals/*.test.mjs"`.
Several site claims are checked against `content/knowledge/resume.md`.
`docs/site-copy.md` line 81 still quotes "AI-native revenue operations builder"
in an old draft note. The site's role line has already moved off that phrase, so
the note is stale, not a check.

## If you'd rather keep "AI" in the first line

Use "Sales operations specialist who builds with AI coding agents and turns
ambiguous business problems into shipped software." It's still true, but it's
longer, and the Claude Code mention later in the paragraph already makes the point.
