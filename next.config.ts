import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({
  // no remark/rehype plugins — GFM-less, plain MDX is enough for these three files
});

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  async redirects() {
    return [
      // /chat was the standalone conversation page. The homepage is now the
      // conversation, so the route is permanently folded into it. ?q= is
      // dropped: nothing links to it externally, and the shell has no
      // auto-send-on-load path.
      { source: "/chat", destination: "/", permanent: true },
      // The prototype route. Kept as a redirect for a while because it was
      // shared locally during the redesign.
      { source: "/lab", destination: "/", permanent: false },
    ];
  },
  // Baseline security headers. Deliberately NOT a Content-Security-Policy:
  // this page loads PostHog from a third-party origin, streams from the AI
  // gateway, and injects an inline ld+json block, so any CSP written without
  // testing against production traffic would either break analytics or be so
  // permissive it asserts nothing. That one is worth doing properly or not
  // at all. HSTS is omitted too — Vercel sets it on custom domains.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here is meant to be framed, and refusing it removes
          // clickjacking as a category without costing anything.
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default withMDX(nextConfig);
