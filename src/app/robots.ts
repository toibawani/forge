import type { MetadataRoute } from "next";

import { getPublicEnv } from "@/lib/env";

/**
 * Crawlers get the marketing and legal pages. Everything behind a session, every
 * API route and every personal practice record is closed — those pages are
 * either useless to a crawler or not ours to publish.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getPublicEnv().appUrl;

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/privacy/hindi", "/terms", "/status"],
        disallow: [
          "/api/",
          "/dashboard",
          "/practice",
          "/profile",
          "/settings",
          "/p/",
          "/auth/",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
