import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

const manrope = Manrope({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "A1 Parola Windows, Gutters & Solar Cleaning",
  description: "Bay Area window, gutter, and solar panel cleaning with easy online booking.",
  applicationName: "A1 Parola",
  manifest: "/manifest.webmanifest",
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
        {children}
      </body>
    </html>
  );
}
