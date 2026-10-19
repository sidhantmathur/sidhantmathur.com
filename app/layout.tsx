import type { Metadata, Viewport } from "next";
import { geistSans, geistMono } from "./fonts";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { EMAIL, GITHUB_URL, HEADSHOT, LINKEDIN_URL, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

// Wave 2: the role leads, in the words a recruiter types into a search box —
// revenue operations, sales operations, RevOps — and Nokia comes before the
// marketplace. The old version spent half its length on tabletop games and
// never said what he does for a living.
const DESCRIPTION =
  "Revenue and sales operations: I build the tools sales and finance teams run on. Sales operations specialist at Nokia, co-founder and CTO of A Darle 20, based in Toronto. Looking for a RevOps / GTM systems role.";

/** The homepage's tab, search result and share-card title. */
const HOME_TITLE = `${SITE_NAME} — RevOps and sales operations`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // `template` applies to every route that exports its own title, so the
  // /resume tab reads "Resume — Sidhant Mathur" instead of a bare "Resume".
  // `default` is the homepage, which has no title of its own — and carries
  // the role since wave 2, because it is what a search result and a pasted
  // link lead with.
  title: {
    default: HOME_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  // Apex is canonical. Preview deploys serve identical content on
  // *.vercel.app, and without this any preview URL that gets indexed or
  // pasted somewhere competes with the real site. Nested routes set their own
  // relative canonical; this one covers "/".
  // `types` emits <link rel="alternate" type="text/markdown">. /llms.txt
  // already exists and nothing pointed at it; this is how an agent fetching
  // the page finds the plain-text version without guessing the path.
  alternates: {
    canonical: "/",
    types: { "text/markdown": "/llms.txt" },
  },
  openGraph: {
    type: "profile",
    siteName: SITE_NAME,
    url: "/",
    title: HOME_TITLE,
    description: DESCRIPTION,
  },
  // The og:image tags come from app/opengraph-image.tsx — Next generates the
  // whole set, including the twitter:* mirror. Nothing to declare here.
};

export const viewport: Viewport = {
  // Colors the mobile browser chrome. Without it, iOS Safari and Chrome frame
  // this dark site in default light. --bg rather than --panel: the status
  // strip is --panel but the document-style routes open on --bg, and the two
  // are close enough that the page background is the safer single answer.
  themeColor: "#0B0A09",
};

// Structured data for a name search. The point is disambiguation — `sameAs`
// is what ties this domain to the GitHub and LinkedIn profiles and tells
// Google they are one person.
//
// Deliberately no `jobTitle`: Sidhant does not want a single title asserted
// as machine-readable fact while he is looking at more than one kind of role.
// The role travels in `description` instead, which reuses the meta
// description verbatim rather than introducing a second, drifting summary.
// `image` is the headshot (wave 2), absolute because structured data is read
// off the page by things that don't resolve relative URLs.
const PERSON_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: SITE_NAME,
  url: SITE_URL,
  image: `${SITE_URL}${HEADSHOT}`,
  description: DESCRIPTION,
  email: `mailto:${EMAIL}`,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Toronto",
    addressRegion: "ON",
    addressCountry: "CA",
  },
  sameAs: [GITHUB_URL, LINKEDIN_URL],
};

// The root layout carries no chrome of its own. The app shell (`/`) owns the
// full viewport — status strip, rail, conversation, context panel — and the
// remaining document-style routes bring their own wrapper from
// app/(legacy)/layout.tsx until phase 4 restyles them.
//
// `overflow-hidden` on the body: the shell is a fixed-height application layout
// whose panes scroll independently, so the document itself never scrolls. The
// legacy wrapper opts back in with its own min-h-dvh scroll container.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-bg text-text">
        <script
          type="application/ld+json"
          // Static object defined in this file — no user input reaches it.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(PERSON_SCHEMA) }}
        />
        {children}
        <AnalyticsProvider />
      </body>
    </html>
  );
}
