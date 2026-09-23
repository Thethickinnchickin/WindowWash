import type { Metadata } from "next";

export type LocalSeoPageConfig = {
  slug: string;
  service: "window cleaning" | "gutter cleaning";
  serviceTitle: string;
  city: string;
  region: string;
  headline: string;
  eyebrow: string;
  description: string;
  estimate: string;
  estimateDetail: string;
  nearbyAreas: string[];
  highlights: string[];
};

export const localSeoPages = {
  "window-cleaning-san-jose": {
    slug: "window-cleaning-san-jose",
    service: "window cleaning",
    serviceTitle: "Window Cleaning",
    city: "San Jose",
    region: "Bay Area",
    headline: "Window Cleaning in San Jose",
    eyebrow: "San Jose residential window cleaning",
    description:
      "A1 Parola provides residential window cleaning in San Jose with online scheduling, clear estimated pricing, and payment handled after the job is completed.",
    estimate: "Est. $20 per window",
    estimateDetail:
      "Enter the number of windows during booking for an estimated total. Final pricing is confirmed after review or completion.",
    nearbyAreas: ["Santa Clara", "Campbell", "Milpitas", "Sunnyvale", "Mountain View", "Palo Alto"],
    highlights: [
      "Residential window cleaning for homes and small properties",
      "Email appointment confirmation and day-of reminders",
      "Online booking with payment handled after completion",
    ],
  },
  "gutter-cleaning-san-jose": {
    slug: "gutter-cleaning-san-jose",
    service: "gutter cleaning",
    serviceTitle: "Gutter Cleaning",
    city: "San Jose",
    region: "Bay Area",
    headline: "Gutter Cleaning in San Jose",
    eyebrow: "San Jose residential gutter cleaning",
    description:
      "Schedule A1 Parola for residential gutter cleaning in San Jose. Booking estimates use gutter linear footage so customers can see a clear starting price.",
    estimate: "Est. $10 per gutter foot",
    estimateDetail:
      "Enter estimated gutter linear feet during booking. The final price may change after the job is reviewed or completed.",
    nearbyAreas: ["Santa Clara", "Campbell", "Milpitas", "Sunnyvale", "Cupertino", "Los Gatos"],
    highlights: [
      "Residential gutter cleaning with simple online scheduling",
      "Estimate based on gutter linear feet",
      "Payment handled after the job is completed",
    ],
  },
  "window-cleaning-bay-area": {
    slug: "window-cleaning-bay-area",
    service: "window cleaning",
    serviceTitle: "Window Cleaning",
    city: "Bay Area",
    region: "Bay Area",
    headline: "Bay Area Window Cleaning",
    eyebrow: "Residential window cleaning across the Bay Area",
    description:
      "Book A1 Parola for Bay Area residential window cleaning with online appointment scheduling, estimated $20 per window pricing, and customer email updates.",
    estimate: "Est. $20 per window",
    estimateDetail:
      "Use the booking form to estimate your service based on window count. The final price is confirmed after review or completion.",
    nearbyAreas: ["San Jose", "Santa Clara", "Sunnyvale", "Mountain View", "Palo Alto", "Fremont", "Oakland", "San Francisco"],
    highlights: [
      "Bay Area residential window cleaning",
      "Fast booking with available appointment slots",
      "Email confirmations, reminders, and receipts",
    ],
  },
} satisfies Record<string, LocalSeoPageConfig>;

export const localSeoPageList = Object.values(localSeoPages);

export function buildLocalSeoMetadata(page: LocalSeoPageConfig): Metadata {
  return {
    title: `${page.headline} | A1 Parola`,
    description: page.description,
    alternates: {
      canonical: `/${page.slug}`,
    },
    openGraph: {
      title: `${page.headline} | A1 Parola`,
      description: page.description,
      url: `/${page.slug}`,
      images: [
        {
          url: "/a1parola-window-hero.png",
          width: 1200,
          height: 630,
          alt: "Clean residential windows after A1 Parola service",
        },
      ],
    },
  };
}
