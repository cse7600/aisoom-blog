import type { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/admin", "/api/", "/community/write", "/preview/"],
      },
    ],
    sitemap: [
      `${SITE_CONFIG.url}/sitemap.xml`,
      `${SITE_CONFIG.url}/sitemap-community.xml`,
      `${SITE_CONFIG.url}/sitemap-profiles.xml`,
    ],
  };
}
