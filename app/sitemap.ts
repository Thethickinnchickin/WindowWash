import type { MetadataRoute } from "next";
import { localSeoPageList } from "@/lib/local-seo-pages";

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
    {
      url: pageUrl("/privacy"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: pageUrl("/terms"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...localSeoPageList.map((page) => ({
      url: pageUrl(`/${page.slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.72,
    })),
  ];
}
