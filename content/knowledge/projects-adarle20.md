# A Darle 20

A marketplace for tabletop game sessions in Latin America. Live at adarle20.com.
Sidhant's role: co-founder and CTO (solo developer).

## The problem

Tabletop roleplaying games are big in Latin America, but finding a good game
master — and paying one — was informal and unreliable. Hosts had no clean way to
take bookings or get paid, especially in a market where many players prefer cash.
Two friends and Sidhant decided to build the marketplace themselves.

## What he built

He architected and shipped the product end to end: host profiles, session
listings, bookings and reservations, real-time chat, email notifications,
refunds, and authentication. Payments run on Stripe Connect, handling host
payouts and platform fees — including OXXO integration so players in Mexico can
pay in cash at a convenience store, which matters in a market where card
penetration is low. The funnel is instrumented end to end — bookings,
conversion, cancellations, refunds, host activation — and that data steers
product and monetization decisions.

The build itself is part of the story. He runs an AI-agent-heavy development
workflow in Claude Code — agents write most of the code, while he keeps
hands-on ownership of architecture, product decisions, code review, and
release. Later he set up a multi-agent workflow that reviews, refactors, and
regression-tests the codebase on its own.

## What it runs on

TypeScript, React and Next.js, Supabase (PostgreSQL) with Prisma, Stripe Connect,
Resend for transactional email, deployed on Vercel.

## Where it stands

Development started in August 2025; the platform launched in March 2026. Four
months in, it has 1,400+ registered users, 127 hosts, and 2,100+ bookings, with
200–400 unique visitors a day. The biggest single test so far was a flagship
251-player event at a 19,000-attendee convention — he built the technology
behind it; his co-founder ran the event on the ground — rated 4.96/5 by
attendees. Running it has taught Sidhant as much about unit economics as about
code: they've tested a commission model against direct event ticket sales and
made real decisions about where the margin actually is.

## What he'd tell a hiring manager

This is the project that proves he can take an ambiguous idea to a
revenue-generating product — including the unglamorous parts like refunds,
payment edge cases, and infrastructure costs.
