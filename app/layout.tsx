import type { Metadata } from "next";
import { geistSans, geistMono } from "./fonts";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { StickyChatBar } from "@/components/chat/sticky-bar";
import { HideOnChat } from "@/components/layout/hide-on-chat";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { CommandPalette } from "@/components/command-palette";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sidhantmathur.com"),
  title: "Sidhant Mathur",
  description:
    "Sales operations specialist and builder. I make internal tools and revenue systems at Nokia, and I'm co-founder and CTO of A Darle 20, a marketplace for tabletop game sessions in Latin America — 2,100+ bookings in its first four months.",
};

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
      <body className="min-h-full flex flex-col pb-11">
        <Header />
        <main>{children}</main>
        <HideOnChat>
          <Footer />
          <StickyChatBar />
        </HideOnChat>
        <CommandPalette />
        <AnalyticsProvider />
      </body>
    </html>
  );
}
