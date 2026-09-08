import type { MetadataRoute } from "next";

const siteUrl = process.env.APP_BASE_URL ?? "https://www.a1parola.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/book"],
      disallow: ["/admin", "/worker", "/team", "/api", "/customer/portal", "/login", "/offline"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
