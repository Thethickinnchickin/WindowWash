import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

const manrope = Manrope({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "a1parola",
  description: "Worker and admin operations app for window washing teams",
  applicationName: "a1parola",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "a1parola",
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
