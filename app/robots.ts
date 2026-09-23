import type { MetadataRoute } from "next";
import { localSeoPageList } from "@/lib/local-seo-pages";

const siteUrl = process.env.APP_BASE_URL ?? "https://www.a1parola.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/book", "/privacy", "/terms", ...localSeoPageList.map((page) => `/${page.slug}`)],
      disallow: ["/admin", "/worker", "/team", "/api", "/customer/portal", "/login", "/offline"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
