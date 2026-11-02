# A Darle 20 feature inventory

**Draft for Sidhant, 2026-11-02. Not the record.** This is a code reading, and a
code reading isn't Sidhant's confirmation. Nothing here goes into
`content/knowledge/` until he ticks it. The block at the end is written so that,
once he has, it can be pasted into `content/knowledge/projects-adarle20.md`
as it stands.

**Where it comes from**

- The marketplace source, `sidhantmathur/rpg-marketplace-1` at `53c9a7a` on
  `main` (a shallow clone, read-only; no history fetched). Every path in the
  evidence column is relative to that repo's root. `.env` files and anything
  holding secrets were not opened.
- The repo's own docs, mainly `README.md`, `AGENTS.md`, `docs/ROADMAP.md` and
  `docs/reference/strategy/adarle20-feature-evidence-2026-09-25.md` (an earlier
  read of the same kind, re-checked here against the current tree).
- The public site, www.adarle20.com, browsed in English on 2026-11-02 without
  an account: no sign-up, no login, no booking, no forms, and analytics
  requests blocked so the visits stay out of the funnel.

**What it leaves out on purpose.** No metrics, counts, prices, percentages or
dates from the code, the docs or the live pages. The platform fee is listed as
a feature, without its split. Cash payments are listed once, marked excluded,
because the resume decisions log excludes them.

**How to read the columns**

- *On the public site*: **yes** means an anonymous visitor can load it (the
  path is given). **Entry** means the button or page is public and the flow
  behind it needs an account. **Account** means it's only reachable signed in.
  **Staff** is admin only. **Internal** is background work nobody sees.
- *Status*: **live**, **beta** (labelled beta in the product), **unfinished**,
  **flagged** (built, switched off or hidden), **dormant** (built, nothing
  uses it), **removed** (gone from the tree or retired), **excluded** (by the
  decisions log).
- *Sidhant confirms*: empty. A tick, a correction, or "leave it out".

## Marketplace

| Feature | In one line | Evidence | On the public site | Status | Sidhant confirms |
| --- | --- | --- | --- | --- | --- |
| Session browse and search | A grid of upcoming games with free-text search, sorted by a ranking of its own. | `src/app/[locale]/sessions/page.tsx`, `src/app/api/session/search/route.ts`, `src/lib/sessionSearch.ts`, `src/lib/feed/sessionRanking.ts` | yes, `/en/sessions` and the home page | live | |
| Filters | Quick filters (when, for beginners, online, in person, free, workshops, one-shots) and a panel for price, experience, genre, format, game, dates, currency and tags, plus a day-and-time picker. | `src/lib/sessionFilters.ts`, `src/lib/dayTimeFilter.ts`, `src/lib/sessionSearchParams.ts` | yes, `/en/sessions` | live | |
| Session page | One page per game: art, host, time in Mexico City and in the viewer's own zone, price, seats, description, tags, the host's reviews and who has joined. | `src/app/[locale]/session/[id]/page.tsx`, `src/components/session/SessionLanding.tsx` | yes, e.g. `/en/session/2334` | live | |
| Reserving a seat | Free and paid one-off sessions, booked from the session page; a paid seat goes through checkout first. | `src/app/api/sessions/[id]/book/route.ts`, `src/app/api/payments/create-intent/route.ts`, `src/app/[locale]/session/[id]/confirm/page.tsx` | entry: the "Book" button; the flow needs an account | live | |
| Recurring series | A host sets up a campaign on a schedule; the platform creates each session ahead of time, and players subscribe to keep their seat or book just the next one. | `src/app/api/session-series/route.ts`, `src/app/api/series/[id]/subscribe/route.ts`, `src/lib/seriesGeneration.ts`, `docs/reference/series-and-payments.md` | yes, e.g. `/en/series/229`; joining needs an account | live | |
| Postponing a series | A host moves one session and every later one forward by whole weeks, with a preview. | `src/app/api/session-series/[id]/postpone/route.ts`, `docs/implement/features/series-shift-following/SPEC.md` | account (hosts) | live on `main`; HUMAN-TODO §C78 records the merge as the owner's call | |
| Events | Event pages with their own tables by day, filters by table and host, and event-only sessions; staff assign hosts to tables. | `src/app/[locale]/events/[slug]/page.tsx`, `src/app/[locale]/events/[slug]/admin/page.tsx`, `src/app/api/admin/events/[slug]/sessions/[sessionId]/assign-dm/route.ts`, `src/components/session/EventCrossSell.tsx`, `docs/reference/event-microsite-template.md` | yes, `/en/events` and each event | live | |
| Private and invite-only games | Sessions kept out of public browse, joined by invite link or password; an organiser can register a whole group with one invite. | `src/app/api/sessions/[id]/invite/route.ts`, `src/app/api/sessions/[id]/validate-invite/route.ts`, `src/lib/sessionPasswordGate.ts`, `src/utils/emails/groupRegistration.ts` | no, by design | live | |
| Host directory | Every approved host on one page, and a rail of featured hosts on the home page. | `src/app/[locale]/dms/page.tsx`, `src/app/api/dms/route.ts`, `src/lib/featuredDms.ts` | yes, `/en/dms` | live | |
| Matching quiz | A short quiz that recommends games from what's open. | `src/app/[locale]/quiz/page.tsx`, `src/app/api/quiz/inventory/route.ts`, `src/lib/quiz/engine.ts` | yes, `/en/quiz` | live | |
| Beginner hub | A guide for people who have never played, linked from browse. | `src/app/[locale]/beginner-hub/page.tsx` | yes, `/en/beginner-hub` | live | |
| Saved games and recently viewed | Players bookmark games, see what they looked at last, and get a reminder before a saved game starts. | `src/app/api/saved-games/route.ts`, `src/lib/recentlyViewed.ts`, `src/emails/templates/lifecycle/SavedGameReminder48h.tsx` | entry: the bookmark on each card | live | |
| Following hosts | Players follow a host and hear when that host lists something new. | `src/app/api/dm-follows/route.ts`, `src/app/[locale]/following/page.tsx`, `src/lib/notifyFollowersOfNewSession.ts`, `src/emails/templates/lifecycle/FollowedDmNewSession.tsx` | entry: "Follow" on profiles and session pages | live | |
| Connections | A player's list of people they've shared a table with. | `src/app/api/connections/route.ts`, `src/app/api/connections/shared-sessions/[userId]/route.ts` | account | live | |
| Sharing | Share links with preview cards, WhatsApp sharing and short links that track their clicks. | `src/lib/shareLink.ts`, `src/lib/whatsapp-share.ts`, `src/app/s/[code]/route.ts`, `src/lib/og-image.ts` | entry: "Share" on session pages | live | |
| Calendar sync | A personal calendar feed and file export of a player's games. | `src/app/api/calendar/feed/route.ts`, `src/app/api/calendar/export/route.ts`, `src/lib/ics-feed-generator.ts` | account; the landing page advertises it | live | |
| La Mesa | A small virtual tabletop inside a session: scene image, initiative, character cards and a map with tokens, for the host and seated players. | `src/app/[locale]/session/[id]/mesa/page.tsx`, `src/app/api/mesa/[sessionId]/route.ts`, `src/components/mesa/MesaRoom.tsx`, `docs/implement/features/mesa-vtt/SPEC-next.md` | no, participants only | beta | |
| Search engine visibility | Sitemap, robots rules, structured data and per-page metadata. | `src/app/sitemap.ts`, `src/app/robots.ts`, `src/lib/structured-data.ts`, `src/lib/seo-metadata.ts` | internal | live | |
| Tienda (store) | A storefront with vendor pages, cart, checkout, orders, bundles, wishlists, disputes and a vendor back office. | `src/app/[locale]/tienda/page.tsx`, `src/app/[locale]/vendedor/page.tsx`, `src/app/api/tienda/checkout/route.ts`, `src/lib/tienda/flag.ts` | not linked; reachable by direct URL and marked noindex | flagged: discoverability is off in production | |
| Venues | Partner venues with their own tables, pricing and payouts. | `prisma/schema.prisma` (`Venue`, `VenueTable`, `VenueAccess`), `docs/implement/features/venue-partner-SPEC-first-slice.md` | no | dormant: schema only, spec parked; venue add-ons retired (`src/components/booking/UnifiedBookingConfirmation.tsx`) | |
| Waitlists | Queueing for a full game. | `docs/reference/series-and-payments.md` (waitlist note), `docs/ROADMAP.md` ("legacy Waitlist removal") | no | removed | |
| Communities | Group feeds and membership. | Described as launch-dark in `docs/reference/strategy/adarle20-feature-evidence-2026-09-25.md`; no route in the current tree | no | removed | |

## Payments

| Feature | In one line | Evidence | On the public site | Status | Sidhant confirms |
| --- | --- | --- | --- | --- | --- |
| Card checkout | Paid seats are paid by card in Stripe's card form. | `src/lib/payments/checkoutCardIntent.ts`, `src/app/api/payments/create-intent/route.ts`, `src/app/api/payments/webhook/route.ts`, `README.md` ("Checkout is card-only") | entry; the landing page says "Card payments secured by Stripe" | live | |
| Host payouts through Stripe Connect | Hosts connect a Stripe account during onboarding and receive their share of each paid seat. | `src/app/api/stripe/connect/create-account/route.ts`, `src/app/[locale]/dm/onboarding/complete/page.tsx`, `src/app/api/payments/connect-webhook/route.ts`, `src/emails/templates/StripeOnboardingApproved.tsx` | account (hosts) | live | |
| Platform fee and pricing | The site works out the price a player sees from what the host wants to earn, covering the platform fee and processing. | `src/lib/dmPayoutPricing.ts`, `src/lib/stripe-fees.ts`, `src/lib/payments/computePaymentSplit.ts` | yes, `/en/become-dm` describes the fee | live | |
| Direct-charge migration | Moving Connect payments to direct charges on the host's own account. | `docs/implement/direct-charges/README.md`, `src/lib/payments/directCharges.ts`, `src/app/api/admin/payments/direct-charges/route.ts` | internal | unfinished: a staged migration | |
| Automatic charges for series | A subscriber's saved card is charged ahead of each session in a series, with reminders and a manual path if the charge fails. | `src/app/api/cron/charge/route.ts`, `src/lib/payments/autoCharge.ts`, `src/emails/templates/lifecycle/SubscriptionPaymentFailed.tsx`, `src/emails/templates/PaymentActionNeeded.tsx` | the series page explains it; the charge is internal | live | |
| Payment deadlines | Unpaid seats are reminded, then released before the session. | `src/lib/paymentDeadlinePolicy.ts`, `src/app/api/cron/payment-deadline-enforcement/route.ts`, `src/app/api/cron/session-payment-reminders/route.ts`, `src/emails/templates/PaymentReminder.tsx` | internal | live | |
| Cancellations and refunds | Every cancellation and refund runs through one executor and a refund queue, under a published policy. | `src/lib/payments/terminateBooking.ts`, `src/lib/refundQueue.ts`, `src/app/api/cron/refund-queue/route.ts`, `docs/implement/stability/termination-chokepoint-SPEC.md`, `src/emails/templates/RefundConfirmation.tsx` | yes, `/en/cancellation-policy`; cancelling needs an account | live; ROADMAP lists production refund acceptance as remaining work | |
| Payment history | A player's own record of what they paid and what came back. | `src/app/api/payments/history/route.ts` | account | live | |
| Tips | Players can tip a host from the host's profile or after a session. | `src/app/[locale]/dms/[dmId]/tip/page.tsx`, `src/app/api/tips/create-intent/route.ts`, `src/emails/templates/TipReceived.tsx` | entry: "Support <host>" on host profiles | live | |
| Event ticketing | Paid event seats are charged through regular Stripe, separately from the Connect split. | `README.md`, `AGENTS.md`, `src/lib/payments/computePaymentSplit.ts` | entry: event sessions | live | |
| Disputes | Card disputes are recorded against the booking they belong to. | `src/lib/payments/handleDisputeEvent.ts`, `prisma/schema.prisma` (`Dispute`) | internal | live | |
| Host earnings and ledger | Hosts see what they've earned, per session, and can export it. | `src/app/api/dm-earnings/route.ts`, `src/app/api/pro/ledger/route.ts`, `src/app/api/pro/ledger/export/route.ts`, `src/app/[locale]/pro/(gated)/income/page.tsx` | account (hosts) | live | |
| Manual host payouts | Staff record payouts made outside Stripe, with a ledger and a host-side request. | `src/app/[locale]/admin/dm-payouts/page.tsx`, `src/app/api/pro/payout-request/route.ts`, `prisma/schema.prisma` (`DmPayoutLedgerEntry`, `PayoutMode`) | staff | live. Partly excluded: `README.md` says invited event hosts are paid in cash, and cash is out | |
| Paid host plan | A subscription tier for the host panel. | `src/app/api/pro/billing/checkout/route.ts`, `src/lib/pro-entitlement.ts`, `docs/ROADMAP.md` ("Pro is frozen") | account | dormant: no live price; the panel itself is open to approved hosts | |
| Cash payments (OXXO) | Paying in cash at a convenience store. | `src/lib/payments/retainedCashPayment.ts`, `docs/implement/stability/oxxo/`, `docs/implement/stability/pending-ddl-SPEC.md` | no | **excluded** by the decisions log. The code agrees it's gone: checkout is card-only and the old rows are being drained | |

## Hosts

| Feature | In one line | Evidence | On the public site | Status | Sidhant confirms |
| --- | --- | --- | --- | --- | --- |
| Applying to host | Would-be hosts apply, staff review and approve, and both steps send an email. | `src/app/[locale]/become-dm/page.tsx`, `src/app/api/dm-application/route.ts`, `src/app/[locale]/admin/dm-applications/page.tsx`, `src/emails/templates/DmApplicationDecision.tsx` | yes, `/en/become-dm` | live | |
| Host onboarding | A step-by-step setup from approval to the first listed session, including Stripe. | `src/app/[locale]/profile/complete/page.tsx`, `src/lib/dmNextStep.ts`, `docs/implement/features/dm-onboarding-ux-PLAN-2026-10-13.md` | account | live; an execution plan from 2026-10-13 is open | |
| Creating and editing games | Forms for one-off sessions and series, with templates from a host's past games. | `src/app/[locale]/sessions/create/page.tsx`, `src/app/[locale]/series/create/page.tsx`, `src/app/api/session/[id]/template/route.ts`, `src/app/api/session/list-for-template/route.ts` | account (hosts) | live | |
| Public host profile | A page per host with overview, calendar, sessions, reviews and badges tabs, a follow button and tipping. | `src/app/[locale]/profile/[id]/page.tsx`, `src/app/[locale]/dms/[dmId]/page.tsx` | yes, e.g. `/en/profile/454de139-2df0-4105-b8b4-342d97705bd3` | live; a redesign is in ROADMAP "Next" | |
| Host's own page and embed | A custom page at a host's own slug, and a snippet to embed it on another site. | `src/app/[locale]/dm/[slug]/page.tsx`, `src/app/embed/dm/[slug]/page.tsx`, `src/components/pro/EmbedSnippetCard.tsx` | yes for hosts who set one up | live | |
| Running the table | The host's roster, attendance marking, completing a session and asking players for reviews. | `src/app/api/bookings/[id]/attendance/route.ts`, `src/app/api/sessions/[id]/complete/route.ts`, `src/app/api/sessions/[id]/request-reviews/route.ts`, `src/app/api/cron/session-completion/route.ts` | account (hosts) | live | |
| Host panel | A back office for hosts: players and notes, calendar, income, prep, broadcasts, promotion, integrations, tables and character cards, badges, insights. | `src/app/[locale]/pro/(gated)/page.tsx` and its siblings, `src/lib/pro-entitlement.ts` | account (approved hosts) | live for approved hosts; the paid tier around it is dormant | |
| Discord integration | Hosts post sessions to their Discord server through a webhook, and players can add their Discord username to a booking. | `src/app/api/pro/discord-webhook/route.ts`, `src/app/api/pro/discord-post/route.ts`, `src/app/api/bookings/[id]/discord/route.ts`, `src/emails/templates/DiscordHandleReminder.tsx` | account | live | |
| Host nudges and digests | Emails to hosts about empty seats, unfinished Stripe setup, quiet periods, plus a weekly and monthly digest. | `src/emails/templates/DmWeeklyDigestEmail.tsx`, `src/emails/templates/lifecycle/DmUnderEnrolled.tsx`, `src/emails/templates/lifecycle/DmStripeSetupReminder.tsx`, `src/emails/templates/DmEmptySeatAutopilotEmail.tsx` | internal | live | |
| Host resources | Guides for running games on the platform. | `src/app/[locale]/dm-resources/page.tsx`, `src/lib/dmGuides.ts` | yes, `/en/dm-resources` | live | |
| Badges and streaks | Levels and badges for hosts and players, recalculated on a schedule and shown on cards and profiles. | `src/lib/badges/BadgeService.ts`, `src/app/api/cron/update-badges/arm.ts`, `docs/implement/features/badges-v2/SPEC.md` | yes, on cards and profiles | live; a second version is specced | |

## Players

| Feature | In one line | Evidence | On the public site | Status | Sidhant confirms |
| --- | --- | --- | --- | --- | --- |
| Accounts | Sign-up and login with email and password, Google or Discord, with email verification and password reset. | `src/components/LoginForm.tsx`, `src/components/auth/GoogleSignInButton.tsx`, `src/components/auth/DiscordSignInButton.tsx`, `src/app/api/auth/signup/route.ts`, `src/app/[locale]/auth/reset-password/page.tsx` | entry: `/en/login`, `/en/signup` | live | |
| Player onboarding | A first-run setup for new players. | `src/app/[locale]/onboarding/page.tsx` | account | live | |
| My sessions | A player's upcoming and past games and series in one place. | `src/app/[locale]/my-sessions/page.tsx`, `src/app/api/user-joined-sessions/[id]/route.ts` | account | live | |
| Reviews and ratings | Players rate and review a host after a game they attended; reviews can be reported and moderated. | `src/app/api/reviews/route.ts`, `src/app/api/review-reports/route.ts`, `src/app/[locale]/admin/moderation/page.tsx`, `src/emails/templates/ReviewRequest.tsx`, `docs/implement/features/reviews-redesign/SPEC.md` | yes: ratings on cards, reviews on session and profile pages; writing one needs an account | live; a redesign is open | |
| Player profiles | Public profiles for players too, linked from session rosters. | `src/app/[locale]/profile/[id]/page.tsx` | yes | live | |
| Account settings | Display name, avatar, email preferences, unsubscribe and account deletion. | `src/app/api/profile/update-display-name/route.ts`, `src/app/api/profile/[id]/avatar/route.ts`, `src/app/api/email-preferences/route.ts`, `src/app/api/email/unsubscribe/route.ts`, `src/app/api/profile/delete-account/route.ts` | account | live | |
| Help and reporting | A support page, ticket form, issue reports and a contact page; staff answer from an inbox. | `src/app/[locale]/support/page.tsx`, `src/app/api/support/route.ts`, `src/app/[locale]/reports/page.tsx`, `src/app/[locale]/admin/support/page.tsx` | yes, `/en/support`, `/en/contact` | live | |
| Player win-back emails | Emails for a booking left unfinished, a sign-up who never booked, a first booking, a five-star game, and players gone quiet. | `src/lib/lifecycle/engine.ts`, `src/emails/templates/lifecycle/AbandonedBooking.tsx`, `src/emails/templates/lifecycle/SignedUpNeverBooked.tsx`, `src/emails/templates/lifecycle/FiveStarBookNext.tsx` | internal | live | |

## Communication

| Feature | In one line | Evidence | On the public site | Status | Sidhant confirms |
| --- | --- | --- | --- | --- | --- |
| In-app chat | A group chat per session and direct messages, in real time, with unread counts and archiving. | `src/app/[locale]/chat/page.tsx`, `src/app/api/chats/route.ts`, `src/components/chat/ChatWindow.tsx`, `src/lib/realtimePrivateChannel.ts` | entry: "Message DM" on session pages | live; `docs/implement/features/chat-overhaul/ROLLOUT.md` (private realtime channels) is an open, owner-gated rollout | |
| Dice in chat | Dice rolls posted into the chat. | `src/app/api/chats/[chatId]/roll/route.ts`, `src/lib/dice.ts` | account | live | |
| Transactional email | Booking, payment, refund, reminder, review and account emails, rendered from templates in the reader's language. | `src/emails/templates/`, `src/lib/email-renderer.ts`, `src/app/api/webhooks/resend/route.ts` | internal | live | |
| Email delivery safeguards | A send log, retries with backoff, suppression of bad addresses and delivery webhooks. | `src/lib/outbound-email/`, `src/lib/email-suppression.ts`, `src/app/api/cron/outbox/route.ts` | internal | live | |
| Second email provider | Amazon SES as an alternative to Resend, behind one switch. | `src/lib/outbound-email/provider.ts`, `src/lib/outbound-email/ses-adapter.ts`, `src/app/api/webhooks/ses/route.ts` | internal | flagged: off by default; Resend sends everything | |
| Session reminders | Reminders before a game. | `src/app/api/cron/send-reminders/route.ts`, `src/emails/templates/SessionReminder.tsx` | internal | live | |
| In-app notifications | A notification bell with real-time updates, alongside email. | `src/app/[locale]/notifications/page.tsx`, `src/lib/notice.ts`, `prisma/schema.prisma` (`Notification`), `CONTEXT.md` | account | live | |
| Unread message digest | An email when chat messages go unread. | `src/app/api/cron/unread-message-digest/arm.ts`, `src/emails/templates/UnreadMessagesDigest.tsx` | internal | live | |
| Announcements | Staff email everyone attending an event. | `src/app/[locale]/admin/announcements/page.tsx`, `src/lib/announcement-outbox.ts`, `src/emails/templates/AnnouncementEmail.tsx` | staff | live | |
| Host broadcasts | Hosts message their players from the host panel, now or scheduled. | `src/app/api/pro/broadcasts/route.ts`, `src/lib/dm-broadcast.ts`, `src/app/api/pro/scheduled-posts/route.ts` | account (hosts) | live | |
| Durable outbox | One delivery path for every outgoing message. | `docs/implement/features/outbox-SPEC.md` | internal | unfinished: approved, implementation not started (ROADMAP "Later") | |

## Operations and admin

| Feature | In one line | Evidence | On the public site | Status | Sidhant confirms |
| --- | --- | --- | --- | --- | --- |
| Admin panel | Users (ban, unban, promote, demote), host applications, payouts, email log, moderation, support inbox, announcements, social media export and store admin. | `src/app/[locale]/admin/` and `src/app/api/admin/` | staff | live | |
| Business metrics | Revenue, usage and per-host views for staff, reconciled against Stripe. | `src/app/[locale]/admin/business-metrics/page.tsx`, `src/lib/metrics/reconciliation.ts`, `docs/reference/business-metrics-reconciliation.md` | staff | live | |
| Automated business review | A scheduled analyst that writes a weekly digest email and an insights feed for the founders. | `src/app/api/cron/business-review/arm.ts`, `src/lib/analytics/analyst.ts`, `src/emails/templates/BusinessReviewDigest.tsx`, `src/app/api/admin/insights/route.ts` | staff | live, but ROADMAP "Now" item 2 says it hadn't succeeded since mid-October and a fix shipped 2026-11-01 | |
| Product analytics | PostHog events, funnels, session replay and error tracking, with personal data scrubbed before sending. | `src/lib/posthog.ts`, `src/lib/posthog-pii.ts`, `src/lib/businessEvents.ts`, `src/lib/attribution.ts`, `docs/reference/posthog-funnels.md` | internal | live | |
| Scheduled jobs | Reminders, completions, payment deadlines, refunds, series upkeep, charges, digests and monitoring, consolidated into a few scheduled routes. | `vercel.json`, `src/app/api/cron/digests/route.ts`, `docs/implement/stability/cron-consolidation-SPEC.md` | internal | live; the "session tick" consolidation is in a shadow run (ROADMAP "Now" item 3) | |
| Money and health monitoring | Scheduled checks that the money in the database matches Stripe, invariant checks, a cron heartbeat and alerts to the founders by email. | `src/app/api/cron/money-truth/arm.ts`, `src/app/api/cron/invariant-checks/arm.ts`, `src/lib/monitoring/cron-heartbeat.ts`, `docs/implement/stability/money-invariants.md` | internal | live | |
| Issue-tracker bots | A Linear webhook that hands an issue to triage and implementation bots in GitHub Actions. | `src/app/api/linear/webhook/route.ts`, `src/lib/linear/dispatchGithub.ts` | internal | unclear: a no-op without its token, and `AGENTS.md` now routes issue work to GitHub Issues | |
| Route security | One handler for auth, validation and rate limits on every API route, with dated security audits. | `src/lib/createApiHandler.ts`, `src/lib/rate-limit-presets.ts`, `docs/implement/stability/security-review-2026-10-16.md` | internal | live | |
| Shelved admin pages | An LLM chat over the database for staff, and a series monitor. | `docs/ROADMAP.md` (idea shelf, "admin surfaces shelved on 2026-10-09") | no | removed | |

## Localisation

| Feature | In one line | Evidence | On the public site | Status | Sidhant confirms |
| --- | --- | --- | --- | --- | --- |
| Spanish and English | The whole site in both languages, with the language in every URL and a switcher in the footer. | `src/i18n/routing.ts`, `src/i18n/locales/es.json`, `src/i18n/locales/en.json` | yes, `/es` and `/en` | live | |
| Spanish by default for Latin America | A first visit from a Latin American country lands in Spanish whatever the phone's language. | `src/i18n/geo-default.ts`, `src/middleware.ts` | yes (adarle20.com redirects to `/es`) | live | |
| Emails in the reader's language | Each person's emails go out in their preferred language. | `src/utils/emailLocalization.ts`, `CONTEXT.md` ("Recipient") | internal | live | |
| Pesos | Prices are stored and shown in Mexican pesos by default, with a currency filter on browse. | `src/lib/formatPrice.ts`, `docs/reference/CURRENCY-UNITS.md` | yes | live | |
| Time zones | Session times are set in Mexico City time and also shown in the viewer's own zone. | `src/lib/cdmxCalendar.ts`, `src/lib/timezone-utils.ts`, `docs/implement/features/timezones/SPEC.md` | yes, "Your time" on session pages | live | |
| Built for phones on slow networks | Mobile-first pages, tuned for mid-range Android phones on slow connections. | `AGENTS.md`, `docs/implement/stability/performance-program.md`, `src/lib/posthog.ts` (deferred analytics) | yes | live; the performance program is ongoing | |

## Unfinished, flagged, dormant or removed

Collected from the tables above, so none of them gets pasted by accident:

- **Flagged**: Tienda (store discoverability off in production), the Amazon SES
  email path (off by default).
- **Unclear**: the Linear issue bots (inert without a token).
- **Unfinished**: the direct-charge migration, the durable outbox, the session
  tick consolidation, the chat private-channel rollout, production refund
  acceptance, the host onboarding plan, and the reviews, badges and profile
  redesigns.
- **Dormant**: venues (schema only), the paid host plan (no live price).
- **Removed**: waitlists, communities, the shelved admin LLM chat and series
  monitor, OXXO checkout.
- **Excluded**: cash payments, including cash paid to invited event hosts.
- **Worth a look**: series postponing is on `main`, while HUMAN-TODO §C78 says
  merging it was the owner's call. If it isn't meant to be live yet, leave it
  out of the block below.

## Also in the product

Paste-ready for `content/knowledge/projects-adarle20.md`, after Sidhant has
struck anything that's wrong. Live features only; nothing flagged, dormant,
removed or excluded; no figures. The existing record already names session
listings, session reservations, Stripe Connect, refunds, Resend, funnel
instrumentation, host activation and PostHog, so those aren't repeated.

```markdown
## Also in the product

- Search and filters — players search open games and filter by day and time, online or in person, free, beginner-friendly, price, experience, genre, format, game and tags.
- Session pages — each game has its own page with the host, the time in Mexico City and in the viewer's own time zone, the price, open seats, a description and the host's reviews.
- Recurring series — a host sets up a campaign on a schedule, the platform creates each session ahead of time, and players subscribe to keep their seat.
- Automatic charges for series — a subscriber's saved card is charged ahead of each session, with reminders and a manual way to pay if the charge fails.
- Events — events get their own pages, with tables by day and hosts assigned to each table.
- Private games — sessions can be kept out of public browse and joined by invite link or password, and an organiser can register a whole group at once.
- Host directory and profiles — every approved host has a public profile with their sessions, reviews, badges and calendar, and players can follow a host to hear about new games.
- Host applications — would-be hosts apply, staff review them, and approved hosts are taken through onboarding, including Stripe setup.
- Platform fee and host payouts — the price a player sees is worked out from what the host wants to earn, covering the platform fee and payment processing.
- Cancellations — every cancellation and refund runs through one path under a published cancellation policy.
- Payment deadlines — unpaid seats get reminders and are released before the session.
- Tips — players can tip a host from the host's profile.
- Reviews and ratings — players review a host after a game they attended, and reviews can be reported and moderated.
- Badges — hosts and players earn badges and levels that show on cards and profiles.
- Real-time chat — every session has a group chat, players and hosts can message each other directly, and dice can be rolled in chat.
- In-app notifications — a notification bell with real-time updates, alongside email.
- Lifecycle emails — automatic emails for unfinished bookings, players who signed up and never booked, players gone quiet, and hosts with empty seats or unfinished setup.
- Host panel — hosts get a back office for their players, calendar, income, session prep, broadcasts to their players and promotion.
- Discord — hosts can post their sessions to their Discord server from the host panel.
- Calendar sync — players can subscribe to a calendar feed of their games.
- Matching quiz and beginner hub — a short quiz recommends games, and a guide welcomes people who have never played.
- La Mesa — a small virtual tabletop inside a session, with a scene, initiative, character cards and a map, in beta.
- Admin panel — staff manage users, host applications, payouts, moderation, support tickets and announcements to event attendees.
- Business review — a scheduled analyst writes a weekly digest of the business for the founders.
- Monitoring — scheduled checks compare the money in the database with Stripe and alert the founders when something is off.
- Spanish and English — the whole site and its emails are in both languages, and visitors from Latin America land in Spanish by default.
- Built for phones — pages are designed mobile-first for mid-range Android phones on slow connections.
```

Left out of the block on purpose: the store, venues, the paid host plan, the
second email provider, waitlists, communities, cash payments, and the
direct-charge migration. Series postponing is left out until the §C78
question above is answered.
