import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/book", "/customer/login", "/customer/register", "/offline"],
      disallow: ["/admin", "/worker", "/team", "/api"],
    },
  };
}
