import type { Metadata } from "next";
import { Suspense } from "react";
import { Manrope } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { TrackableEvents } from "@/components/analytics/trackable-events";

const manrope = Manrope({
  subsets: ["latin"],
});

const siteUrl = process.env.APP_BASE_URL ?? "https://www.a1parola.com";
const siteDescription =
  "A1 Parola provides Bay Area window and gutter cleaning with online booking, estimated $20 per window and $10 per gutter foot pricing, and email appointment updates.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "A1 Parola Window & Gutter Cleaning | Bay Area Service",
    template: "%s | A1 Parola",
  },
  description: siteDescription,
  applicationName: "A1 Parola",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "A1 Parola Window & Gutter Cleaning",
    title: "A1 Parola Window & Gutter Cleaning | Bay Area Service",
    description: siteDescription,
    url: "/",
    images: [
      {
        url: "/a1parola-window-hero.png",
        width: 1200,
        height: 630,
        alt: "Clean home after A1 Parola window and gutter cleaning service",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "A1 Parola Window & Gutter Cleaning | Bay Area Service",
    description: siteDescription,
    images: ["/a1parola-window-hero.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "A1 Parola",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={manrope.className}>
        <PwaRegister />
        <Suspense fallback={null}>
          <GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        </Suspense>
        <TrackableEvents />
        {children}
      </body>
    </html>
  );
}
