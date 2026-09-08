import type { MetadataRoute } from "next";

const siteUrl = process.env.APP_BASE_URL ?? "https://www.a1parola.com";

function pageUrl(path: string) {
  return new URL(path, siteUrl).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: pageUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: pageUrl("/book"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
