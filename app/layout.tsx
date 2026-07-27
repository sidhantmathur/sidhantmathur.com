import type { Metadata, Viewport } from "next";
import { geistSans, geistMono } from "./fonts";
import { AnalyticsProvider } from "@/components/analytics-provider";
import "./globals.css";

const DESCRIPTION =
  "Sales operations specialist and builder. I make internal tools and revenue systems at Nokia, and I'm co-founder and CTO of A Darle 20, a marketplace for tabletop game sessions in Latin America — 2,100+ bookings in its first four months.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sidhantmathur.com"),
  // `template` applies to every route that exports its own title, so the
  // /resume tab reads "Resume — Sidhant Mathur" instead of a bare "Resume".
  // `default` is the homepage, which has no title of its own.
  title: {
    default: "Sidhant Mathur",
    template: "%s — Sidhant Mathur",
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
    siteName: "Sidhant Mathur",
    url: "/",
    title: "Sidhant Mathur",
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
// `description` reuses the meta description verbatim rather than introducing a
// second, drifting summary.
const PERSON_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Sidhant Mathur",
  url: "https://sidhantmathur.com",
  description: DESCRIPTION,
  email: "mailto:hello@sidhantmathur.com",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Toronto",
    addressRegion: "ON",
    addressCountry: "CA",
  },
  sameAs: [
    "https://github.com/sidhantmathur",
    "https://www.linkedin.com/in/sidhantmathur",
  ],
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
