# Application links

One link per job application, so PostHog can say which applications turned into
visits. Optionally, a fit check against that posting, sent as "here's how my
experience maps onto your role", with nothing stored anywhere.

Written 2026-10-19, with the branch that built it (`worktree-agent-aa8fedc2a0a6a9df2`).

## What the site does with `?ref=`

It counts the visit and does nothing else. There is no greeting, and the page
never shows the value, for two reasons:

- **The repo is public, `content/` included.** An allowlist of companies in the
  source or the build would publish who you've applied to, your current
  employer among the readers.
- **Text taken from the URL can't be shown.** Anyone could make the page say
  anything by editing the link.

So `?ref=acme` becomes a PostHog property called `ref` and goes nowhere else.
`evals/application-links.test.mjs` holds this: only `lib/analytics.ts` reads the
parameter, and the value goes to one place, a PostHog session property.

What happens to it:

- It's read once, from the address the visitor landed on, and registered as a
  **session** super property. Every event in that tab carries it from then on:
  the pageview, `chat_permalink_opened`, `resume_download`, `resume_open` and
  `contact_click`. That holds after a client-side move to `/resume`, where the
  address bar no longer shows it. (Checked in a browser: a resume download after
  navigating carried `ref`.)
- It stays in the address bar while panels open and close. It used to be dropped
  the moment a panel opened, and a replayed fit check opens its panel on load,
  so the ref was gone before analytics could read it.
- The `#c=…` fragment, which is the whole conversation, is never sent to
  PostHog. Before this change posthog-js reported `location.href` with the
  fragment, so every opened permalink was being uploaded as `$current_url`.
  `disable_capture_url_hashes` is on now.
- PostHog drops traffic that looks automated (headless browsers, link
  unfurlers), so an ATS preview bot opening the link doesn't count as a visit.

The recipient can see `?ref=acme` in the link. That's the same as any `utm_`
tag and says nothing they don't already know.

## The ref convention

- **A lowercase company slug.** `acme`, `northwind-data`, `globex-revops`.
- **Never a person's name.** Not the recruiter's, not the hiring manager's, not
  as `jane-at-acme`.
- Lowercase letters, digits and hyphens, up to 40 characters, starting and
  ending with a letter or digit. Anything else is dropped without an error:
  an email address, a space, a dot. `Acme` is lowercased to `acme`.
- Two roles at one company get two slugs: `acme-revops` and `acme-salesops`.
- Keep the slug-to-application list somewhere private, like your tracker
  spreadsheet. Never in this repo.

## Two kinds of link

| Link | Use it for | Length |
| --- | --- | --- |
| `https://sidhantmathur.com/?ref=acme` | Any "website" or "portfolio" field, anywhere a URL goes | 31 + the slug |
| The short fit link, plus `?ref=acme` | A cover note, an ATS message, a plain-text email | about 1,650 |
| The full conversation link, plus `?ref=acme` | Only as a hyperlink in a rich-text email | about 3,300 |

Measured on one real fit check, run through the site against a 3,891-character
RevOps posting with a 14-row table (`evals/fixtures/recorded-fit-check.json`):

| Version | Characters |
| --- | --- |
| Whole conversation, before this change (posting included) | 4,523 |
| Whole conversation, posting and the internal extraction step left out | 3,271 |
| Short fit link: verdict, counts, the three strongest cited rows, every gap, the summary | 1,635 |
| Add `?ref=northwind-data` to either | +19 |

The posting was only about a quarter of the link. The table is the rest: about
2,900 characters on its own, and no lossless trim gets near 2,000. A preset
compression dictionary built from the knowledge base was tested too and only
reached 2,756. So the short link carries the scorecard instead of the whole
table, the same cut the existing "copy the scorecard" export makes, and the
replayed table says so: "Showing 3 of 14 requirements: the strongest cited
ones. The counts cover all 14, and every gap is listed below."

## The routine, per application

1. **Paste the posting into the fit check.** On the site, choose "paste a job
   description" (or type `/jd`), paste the posting and press "Check the fit".
   One turn, about 25 seconds.

2. **Read the table and decide whether an honest partial fit is worth sending.**
   - Read "What he doesn't have" first. If a gap is one of the posting's hard
     requirements, send the plain `?ref=` link and skip the fit link.
   - Read every row's evidence as a claim about you. It's model output. If a
     row is wrong, or overstates something, don't send it.
   - Look at what the short link will carry: the summary, the three strongest
     cited rows and every gap. If the case for you is in the rows that get cut,
     the short link undersells you. Send the plain link and make the case in
     your note.
   - The table holds at most 14 requirements. On a long posting, the ones past
     the fourteenth get no row: some show up in the gaps or the summary, and
     some don't appear at all.

3. **Copy the short link and add `?ref=`.**
   - Open "export" (in the strip under the composer), then "Short link", then
     "build a short link", then "copy the short link".
   - Open the copied link once in a private window *before* adding the ref,
     so your own check doesn't count as a visit from that company. It should
     open on the fit check banner with your resume, email and LinkedIn under it.
   - Add the ref **before the `#`**:

     ```
     https://sidhantmathur.com/?ref=acme#c=tVbbbhw3DP0V…
     ```

     If you paste `?ref=acme` on the end instead (`…#c=tVbb…?ref=acme`), it
     still works: the conversation decodes and the ref is still counted. Both
     orders are tested. Before-the-`#` is the standard form, and it's the one
     that shows in PostHog's `$current_url`.
   - Paste it into the application. Don't open it again after adding the ref.

What the recipient sees, at desktop and on a phone: a banner saying it's a fit
check run against your record, which notes that the posting is left out and
that the page is a snapshot rather than a live session; then your resume
download, email (copyable) and LinkedIn; then the request, the summary, and the
excerpt table beside it, or behind the "Role fit" chip on a phone. The link
stores nothing. Anyone holding it can read it, because base64 is encoding, not
encryption, and it's frozen at the moment you built it.

## The query

PostHog → SQL editor (or a new SQL insight). This only reads; nothing is
created until you choose to save it. Events carry `ref` from the deploy of this
branch onward.

```sql
-- Visits, fit links opened, resume downloads and contact clicks, per application.
SELECT
    properties.ref AS ref,
    uniqIf(properties.$session_id, event = '$pageview') AS visits,
    countIf(event = 'chat_permalink_opened') AS fit_links_opened,
    countIf(event = 'resume_download') AS resume_downloads,
    countIf(event = 'resume_open') AS resume_opens,
    countIf(event = 'contact_click') AS contact_clicks,
    min(timestamp) AS first_seen,
    max(timestamp) AS last_seen
FROM events
WHERE isNotNull(properties.ref)
    AND timestamp > now() - INTERVAL 180 DAY
GROUP BY ref
ORDER BY last_seen DESC
```

Which contact channel each application used (`email_copy`, `email_link`,
`linkedin`), and from where (`surface = 'replay'` is the fit-check banner):

```sql
SELECT
    properties.ref AS ref,
    properties.channel AS channel,
    properties.surface AS surface,
    count() AS clicks
FROM events
WHERE event = 'contact_click'
    AND isNotNull(properties.ref)
GROUP BY ref, channel, surface
ORDER BY ref, clicks DESC
```

Reading it:

- `visits` counts sessions with a pageview. A recruiter who forwards the link
  passes the ref along, so their colleagues' visits count under the same
  application. That's the attribution you want.
- A visit that arrives later without the ref (someone types the address in) is
  a separate, unattributed session.
- `fit_links_opened` is only non-zero for applications you sent a fit link with.
- Your own fit-check run sends the posting to PostHog as the
  `chat_message_sent` event's `message`, as every chat turn does. The posting
  was public anyway, but it is stored there. The recipient's replay sends
  nothing from the conversation.
