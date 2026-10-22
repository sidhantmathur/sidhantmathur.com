import type { Metadata, Viewport } from "next";
import { geistSans, geistMono } from "./fonts";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { EMAIL, GITHUB_URL, HEADSHOT, LINKEDIN_URL, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

// Who he is, both role families and one proof point, in ~155 characters so a
// search snippet and a LinkedIn or Slack preview show all of it. The proof is
// the resume's: a self-serve Power App for quarterly executive reporting, used
// by 80+ stakeholders across 7 regions, that replaced a manual quarter-end
// process. The work leads; the tool name stays on the case study.
const DESCRIPTION =
  "Sales operations at Nokia, open to RevOps and delivery ops roles. Replaced a manual quarter-end process with an app 80+ stakeholders in 7 regions use.";

/** The homepage's tab, search result and share-card title. */
const HOME_TITLE = `${SITE_NAME} — Sales operations, open to RevOps and delivery ops`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // `template` applies to every route that exports its own title, so the
  // /resume tab reads "Resume — Sidhant Mathur". `default` is the homepage,
  // which has no title of its own.
  title: {
    default: HOME_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  // Apex is canonical: preview deploys serve identical content on
  // *.vercel.app, and an indexed preview URL would compete with the real site.
  // Nested routes set their own relative canonical. `types` emits
  // <link rel="alternate" type="text/markdown"> so an agent fetching the page
  // finds /llms.txt without guessing the path.
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
  // og:image and its twitter:* mirror come from app/opengraph-image.tsx.
};

export const viewport: Viewport = {
  // Colors the mobile browser chrome, which iOS Safari and Chrome otherwise
  // draw light around this dark site. --bg rather than --panel: the document
  // routes open on --bg, and the two are close enough for one answer.
  themeColor: "#0B0A09",
};

// Structured data for a name search: `sameAs` tells search engines this domain
// and the GitHub and LinkedIn profiles are one person.
//
// No `jobTitle` on purpose: Sidhant doesn't want a single title asserted as
// machine-readable fact while he is looking at more than one kind of role.
// `image` is absolute because structured-data readers don't resolve relative
// URLs.
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

// The root layout carries no chrome. The app shell at `/` owns the full
// viewport, and the document routes bring their own from
// components/layout/doc-page.tsx.
//
// The body is `overflow-hidden` because the shell is a fixed-height layout
// whose panes scroll independently. DocPage owns its own scroll container.
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
