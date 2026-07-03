import type { Metadata } from "next";
import { geistSans, geistMono } from "./fonts";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { StickyChatBar } from "@/components/chat/sticky-bar";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { CommandPalette } from "@/components/command-palette";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sidhantkmathur.com"),
  title: "Sidhant Mathur",
  description:
    "Sales operations specialist and builder. I make internal tools and revenue systems at Nokia, and I run A Darle 20, a marketplace for tabletop game sessions in Latin America.",
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
        {children}
        <Footer />
        <StickyChatBar />
        <CommandPalette />
        <AnalyticsProvider />
      </body>
    </html>
  );
}
