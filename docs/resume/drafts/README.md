# Resume drafts: RevOps and delivery ops

These are review drafts for Sidhant, written 2026-10-22. None of them are live.
The canonical resume is still `docs/resume/resume-source.md`, mirrored in
`content/knowledge/resume.md`, `public/resume.pdf` and `app/resume/page.tsx`. None
of those four were touched, and the site renders nothing from this folder.

## What's here

| File | What it is |
| --- | --- |
| `resume-revops.md` / `.docx` / `.pdf` | Tailored for RevOps, GTM systems and sales ops roles at AI-forward companies. One page. |
| `resume-delivery-ops.md` / `.docx` / `.pdf` | Tailored for delivery, professional services and deployment operations roles. One page. |
| `summary-fix.md` | A corrected summary for the canonical resume, written as a diff you can paste. It fixes the blend of roles and tools the critics found. |
| `build.py` | Writes both `.md` and `.docx` files from one block of text, so the two can't drift. |

To rebuild after editing the text in `build.py`:

```sh
python3 docs/resume/drafts/build.py      # needs python-docx (already installed here)
cd docs/resume/drafts && soffice --headless --convert-to pdf resume-revops.docx resume-delivery-ops.docx
```

If you'd rather edit the `.docx` in Word, go ahead. Just know that `build.py` will
overwrite those edits if anyone runs it again.

**Layout.** Both copy `public/resume.pdf` (the current export of the canonical
resume): Letter, 0.5in side margins, Calibri 10pt (Carlito in the LibreOffice
PDFs, which has the same metrics), a centered 17pt name, section heads over a thin
grey rule, company and location on one line, title and dates on the next. The
section order is the same: summary, experience (Nokia, A Darle 20, freelance,
Dell), education, technical skills, citizenship. Both PDFs were rendered to PNG
and checked: each is one page, with no orphaned words and no overflow.

## Rules both drafts follow

- **Same facts as the canonical resume, no new ones.** One sentence comes from
  `content/knowledge/` rather than the resume (judgment call 1).
- **Every number is unchanged.** A script compared every number in the drafts with
  `resume-source.md`. Neither draft has a number the canonical resume lacks, and
  the only one cut is "3+ years", from the RevOps summary.
- **Verbs stay as true as the source.** "Identified $1.2M" stays "identified". No
  "saved", "drove" or "led" was added.
- **Keywords only where his facts back them.** Used: sales reporting, data
  modeling, SQL, forecasting, headcount, quarter-end close, executive reporting,
  requirements, stakeholder rollout, global rollout, adoption, automation,
  internal tools, payments, refunds, funnel, activation, operating cadence,
  Claude Code. Left out on purpose: CPQ, PSA, SOW, Salesforce admin or Flow,
  utilization of people, territory and quota.
- **The work leads, the tool name follows.** "Built a self-serve quarterly
  executive reporting app (Power Apps)", not "Built a Power App".

## `resume-revops.md`: changes from the canonical resume

1. **Summary rewritten.**
   - It now leads with his title ("Sales operations specialist at Nokia") instead
     of "AI-native revenue operations builder".
   - It says what he builds (sales reporting, data models, internal tools) and that
     he owns each one through rollout and support.
   - It drops the blended "3+ years … (150+ users across 7 regions)" line.
   - It keeps A Darle 20 with its two numbers and the Claude Code workflow.
   - It ends "RevOps or GTM systems role".
2. **Nokia sales ops bullets reordered.** The Salesforce Analytics → Power BI
   migration now comes first (sales reporting, data model and SQL are the RevOps
   keywords). The quarterly reporting app is second. Its wording now leads with the
   work and puts "(Power Apps)" after it.
3. **Workforce management left as it was.**
4. **A Darle 20 reordered for a revenue reader.** The order is now: traction
   numbers, funnel instrumentation, payments, how it was built, the multi-agent
   audit workflow, then the 251-player event. All six bullets are kept. "End-to-end"
   became "end to end", and the em-dash asides became parentheses.
5. **Freelance and Dell** are lightly copy-edited. The facts and numbers are the
   same.
6. **Skills regrouped** as sales reporting & data (SQL and data modeling first),
   internal tools & automation, AI-assisted development, and engineering.
   "Data modeling" is new to the skills list, but it comes from the Power BI
   bullet. The standalone "Python" was dropped because "Python automation" covers
   it.
7. **Sentence case** for section heads, job titles and "Co-founder & CTO"
   (judgment call 4).

## `resume-delivery-ops.md`: changes from the canonical resume

1. **Summary rewritten to lead with workforce management.**
   - It opens "3+ years in operations at Nokia". Then it names headcount reporting
     and forecasting for a 3,000–4,000-person organization, then the move to sales
     operations, where he takes internal tools from a vague request to global
     rollout and support across time zones.
   - A Darle 20 is framed as operations: payment and refund flows, funnel
     instrumentation, and the technology behind a 251-player live event.
   - It ends "delivery operations role".
2. **Nokia sales ops bullets reordered.**
   - The full-lifecycle bullet (requirements → executive demos → global rollout →
     support across time zones) now comes first.
   - The quarterly app is second, now worded as the thing "that runs the quarterly
     executive reporting cadence". "Consumed" became "took" so the bullet fits on
     the page.
   - The Power BI migration is third.
3. **Workforce management** keeps both bullets unchanged. It stays below sales
   operations in the experience section, and the summary carries the lead
   (judgment call 2).
4. **A Darle 20 reordered for operations.**
   - The 251-player event now comes first, with "my co-founder ran the event on the
     ground" added (judgment call 1).
   - Then payments and refunds, funnel instrumentation, and traction.
   - The build bullet and the multi-agent audit bullet are merged into one, which
     saves two lines.
5. **Freelance and Dell** are the same as in the RevOps draft.
6. **Skills regrouped** as reporting & forecasting, internal tools & automation,
   payments & product ("Stripe" became "Stripe Connect", which is the canonical
   bullet's own term), and AI-assisted development.

## Judgment calls to check

1. **The co-founder sentence.** "My co-founder ran the event on the ground" comes
   from `content/knowledge/projects-adarle20.md` and `faq.md`, not from the
   resume. It narrows the claim rather than adding one, and a delivery-ops
   interviewer will ask who ran the event. It's also the only first-person pronoun
   in either draft. Cut it, or reword it to "co-founder ran it on the ground", if
   you'd rather not.
2. **Workforce management stays second in delivery ops.** Experience is still in
   reverse date order, so the headcount and forecasting work leads through the
   summary, not through its position. The alternative is a single Nokia block with
   the workforce role listed first. It reads oddly and confuses applicant
   tracking systems, so I didn't do it.
3. **"3+ years".** It is kept exactly. Nokia from Oct 2022 to today is four years,
   so "4 years" would also be true now. Your call. It's the one place where
   "keep every number exactly" and "current" disagree.
4. **Sentence case.** The canonical PDF has all-caps section heads and Title Case
   job titles ("Sales Operations Specialist"). The drafts use sentence case, which
   matches `resume-source.md` and the site's rules. If you want Title Case job
   titles on the version you send out, it's a find-and-replace in `build.py`.
5. **"Salesforce" in skills.** It's kept because the canonical resume lists it.
   Your Salesforce work in the record is reporting, which you migrated off
   Salesforce Analytics. A RevOps screener may read a bare "Salesforce" as admin or
   Flow experience. "Salesforce (reporting)" would be more exact.
6. **Two inherited verbs.** "Grew to 1,400+ registered users" and "saving $100k+
   in agency fees" (freelance) are both kept as the canonical resume has them. If
   either is closer to "identified" than to a measured result, soften it the same
   way the $1.2M is.
7. **"Adoption"** (RevOps summary) is a fair reading of 150+ users and 80+
   stakeholders. There is no adoption-rate metric, and the draft doesn't claim one.
8. **"Operating cadence"** (delivery ops, quarterly app). The phrase comes from the
   knowledge base's description of that app (`faq.md`). Check that it matches how
   you'd describe the quarter-end process.
9. **"Deployment operations".** It's named in the delivery-ops summary because the
   brief listed it. `faq.md` only says "delivery operations". Drop "or deployment"
   if you're not applying to those roles.
10. **Phone number.** It's kept, as in the canonical resume, because these are for
    applications. The website version deliberately has no phone number.
11. **No bold numbers inside bullets.** This matches `public/resume.pdf`. The older
    `.docx` bolded them. Bolding would help someone skimming, but it costs nothing
    to leave it out, and it keeps the page calm.
12. **Not added, though the knowledge base has it:** "bringing LLMs and Python into
    these workflows" at Nokia (`projects-nokia.md`). True but not on the
    canonical resume, so I left it out. The sponsorship line is gone everywhere
    at your word (2026-10-22): it only ever applied to Canada.

## Found on the way (not fixed here)

**`docs/resume/Sidhant_Mathur_Resume_GTM.docx` is stale.** It does not match
`resume-source.md` or `public/resume.pdf`. Differences:

- Phone 512-808-9684.
- Email sidhant185@gmail.com.
- The domain typo "sidhantkmathur.com".
- "saving finance staff 4–6 hours/day" (the canonical resume says "one finance
  analyst's entire workday").
- "Founder & Full-Stack Developer, Feb 2025".
- Freelance "May 2019 – Present".
- Dell "91% accuracy".
- An older summary.

`resume-source.md` says it was extracted from this file, but the PDF was clearly
made from a newer file that isn't in the repo. `docs/launch-checklist.md` still says
to export the PDF from this `.docx`. **Don't send that `.docx` to anyone.** Use the
drafts here or `public/resume.pdf`.

## Round 3 changes (2026-10-22)

From a blind review of both PDFs:

- "Canadian citizen" moved from a stranded line under the skills into the
  header, beside the city, where a screener checks work authorization first.
- The freelance block keeps two bullets; "Resolved a client security breach…"
  is cut as the weakest line on the page. It is still on the canonical resume.
- The RevOps summary no longer says "adoption" (nothing in the record measures
  it) or "teams run on"; the delivery summary names "a delivery operations
  role" (your words), not "deployment operations".

## The site's resume is built here too (2026-10-22)

`build.py` has a third variant, `canonical`: the general resume, word for word
`docs/resume/resume-source.md` with the corrected summary from `summary-fix.md`.
Its PDF is what the site serves:

    python3 docs/resume/drafts/build.py
    cd docs/resume/drafts && soffice --headless --convert-to pdf resume-canonical.docx
    cp resume-canonical.pdf ../../../public/resume.pdf
    cp resume-canonical.pdf ../../Sidhant_Mathur_Resume.pdf

Change the canonical text in `resume-source.md`, `content/knowledge/resume.md`,
`app/resume/page.tsx` and the `canonical` variant together; the site's tests
check claims against `content/knowledge/resume.md`. Headings are sentence case
now, which is the one visible difference from the July export.
