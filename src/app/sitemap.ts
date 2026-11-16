import type { MetadataRoute } from "next";

import { getPublicEnv } from "@/lib/env";

/**
 * Only pages that are public and meaningful to a stranger. Practice records
 * (`/p/[id]`) are deliberately excluded: they are personal enough that the
 * pages themselves carry `noindex`.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getPublicEnv().appUrl;
  const now = new Date();

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/privacy/hindi`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/status`, lastModified: now, changeFrequency: "daily", priority: 0.2 },
  ];
}
