import type { MetadataRoute } from "next";

// Everything here is meant to be found — this is a portfolio during a job
// hunt, so the only disallow is the chat endpoint, which is a POST-only route
// that a crawler can do nothing useful with and which costs money per call.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: "https://sidhantmathur.com/sitemap.xml",
    host: "https://sidhantmathur.com",
  };
}
