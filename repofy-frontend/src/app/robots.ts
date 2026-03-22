import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://repofy.dev";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/callback", "/checkout-complete", "/dashboard", "/settings"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
