import type { Metadata } from "next";
import { geistSans, geistMono } from "./fonts";
import { AnalyticsProvider } from "@/components/analytics-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sidhantmathur.com"),
  title: "Sidhant Mathur",
  description:
    "Sales operations specialist and builder. I make internal tools and revenue systems at Nokia, and I'm co-founder and CTO of A Darle 20, a marketplace for tabletop game sessions in Latin America — 2,100+ bookings in its first four months.",
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
        {children}
        <AnalyticsProvider />
      </body>
    </html>
  );
}
