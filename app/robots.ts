import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Everything is meant to be found except the chat endpoint: it is POST-only,
// a crawler can do nothing useful with it, and every call costs money.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
