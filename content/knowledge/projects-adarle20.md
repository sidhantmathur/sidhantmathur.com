# A Darle 20

A marketplace for tabletop game sessions in Latin America. Live at adarle20.com.
Sidhant's role: founder and developer.

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
penetration is low.

The build itself is part of the story. Sidhant wrote very little of the code by
hand. He directed AI coding agents through the full build, and later set up a
multi-agent workflow in Claude Code that reviews, refactors, and
regression-tests the codebase on its own. His job was architecture, product
decisions, and quality control — the agents did the typing.

## What it runs on

TypeScript, React and Next.js, Supabase (PostgreSQL) with Prisma, Stripe Connect,
Resend for transactional email, deployed on Vercel.

## Where it stands

The platform is live and processing real payments. [TODO: one or two concrete
numbers — bookings, hosts, or revenue range — pending what we're comfortable
sharing.] Running it has taught Sidhant as much about unit economics as about
code: they've tested a commission model against direct event ticket sales, run a
large community event, and made real decisions about where the margin actually
is.

## What he'd tell a hiring manager

This is the project that proves he can take an ambiguous idea to a
revenue-generating product — including the unglamorous parts like refunds,
payment edge cases, and infrastructure costs.
