import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getCustomerSessionAccount } from "@/lib/customer-auth";
import { env } from "@/lib/env";
import { NeonLogo } from "@/components/brand/neon-logo";

const heroFont = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const publicSiteUrl = (process.env.APP_BASE_URL ?? "https://www.a1parola.com").replace(/\/$/, "");
const homeDescription =
  "Book A1 Parola Window Cleaning for Bay Area residential window cleaning. Online scheduling, estimated $20 per window pricing, email appointment updates, and payment after completion.";
const serviceAreas = [
  "San Jose",
  "Santa Clara",
  "Sunnyvale",
  "Mountain View",
  "Palo Alto",
  "Fremont",
  "Oakland",
  "San Francisco",
  "Bay Area",
];

export const metadata: Metadata = {
  title: "A1 Parola Window Cleaning | Bay Area Window Service",
  description: homeDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "A1 Parola Window Cleaning | Bay Area Window Service",
    description: homeDescription,
    url: "/",
    images: [
      {
        url: "/a1parola-window-hero.png",
        width: 1200,
        height: 630,
        alt: "A bright home with clean windows",
      },
    ],
  },
};

const serviceCards = [
  {
    title: "Estimated $20 Per Window",
    detail: "Your booking total is an estimate based on the number of windows and may change after review.",
  },
  {
    title: "Online Scheduling",
    detail: "Choose a preferred appointment time and get email updates for your booking.",
  },
  {
    title: "Pay After Completion",
    detail: "Payment is handled after the window cleaning is finished and the team marks the job paid.",
  },
];

const processSteps = [
  {
    title: "1. Count Windows",
    detail: "Enter the number of windows and add any notes the team should know before arriving.",
  },
  {
    title: "2. Schedule Online",
    detail: "Pick a preferred appointment time and get email confirmation after the booking is submitted.",
  },
  {
    title: "3. Pay After Completion",
    detail: "Payment is handled after the work is finished and the team marks the job paid.",
  },
];

export default async function HomePage() {
  const [staffUser, customerAccount] = await Promise.all([
    getSessionUser(),
    getCustomerSessionAccount(),
  ]);
  const contactItems = [
    env.COMPANY_CONTACT_PHONE ? { label: env.COMPANY_CONTACT_PHONE, href: `tel:${env.COMPANY_CONTACT_PHONE}` } : null,
    env.COMPANY_CONTACT_EMAIL ? { label: env.COMPANY_CONTACT_EMAIL, href: `mailto:${env.COMPANY_CONTACT_EMAIL}` } : null,
  ].filter(Boolean) as { label: string; href: string }[];

  if (staffUser) {
    if (staffUser.role === "admin") {
      redirect("/admin");
    }

    redirect("/worker/today");
  }

  if (customerAccount) {
    redirect("/customer/portal");
  }

  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${publicSiteUrl}/#business`,
    name: "A1 Parola Window Cleaning",
    alternateName: "A1 Parola",
    description: homeDescription,
    url: publicSiteUrl,
    image: `${publicSiteUrl}/a1parola-window-hero.png`,
    logo: `${publicSiteUrl}/a1parola-logo.svg`,
    telephone: env.COMPANY_CONTACT_PHONE,
    email: env.COMPANY_CONTACT_EMAIL,
    areaServed: serviceAreas.map((area) => ({
      "@type": area === "Bay Area" ? "AdministrativeArea" : "City",
      name: area,
    })),
    priceRange: "Estimated $20 per window",
    makesOffer: {
      "@type": "Offer",
      name: "Residential window cleaning",
      priceSpecification: {
        "@type": "PriceSpecification",
        price: "20",
        priceCurrency: "USD",
        unitText: "window",
        description: "Estimated rate per window. Final price is confirmed after review or completion.",
      },
      itemOffered: {
        "@type": "Service",
        name: "Window cleaning",
        serviceType: "Residential window cleaning",
      },
    },
  };

  return (
    <main className="min-h-screen bg-[var(--landing-bg)] text-[var(--landing-ink)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd).replace(/</g, "\\u003c") }}
      />
      <section className="relative min-h-[82svh] overflow-hidden text-white">
        <Image
          src="/a1parola-window-hero.png"
          alt="Clean home with bright windows"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,7,4,0.92),rgba(8,7,4,0.62)_46%,rgba(8,7,4,0.08)_74%)]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--landing-bg)] to-transparent" />

        <div className="relative mx-auto flex min-h-[82svh] max-w-7xl flex-col px-4 pb-16 pt-5 sm:px-6 lg:px-8">
          <header className="landing-rise flex flex-wrap items-center justify-between gap-3 border-b border-white/20 pb-4">
            <div className="flex items-center gap-3">
              <NeonLogo compact />
              <div>
                <p className="text-sm font-black uppercase text-white">A1 Parola</p>
                <p className="text-xs font-semibold text-[#f7e680]">Window cleaning</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/customer/login"
                className="min-h-11 rounded-lg border border-white/35 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
              >
                Customer Login
              </Link>
              <Link
                href="/book"
                className="min-h-11 rounded-lg bg-[#D0B830] px-4 py-2 text-sm font-black text-[#080704] shadow-[0_0_26px_rgba(208,184,48,0.34)]"
              >
                Book Service
              </Link>
            </div>
          </header>

          <div className="landing-rise flex flex-1 items-center [animation-delay:120ms]">
            <article className="max-w-3xl py-12 sm:py-16">
              <p className="inline-flex rounded-full border border-[#D0B830]/60 bg-[#080704]/65 px-3 py-1 text-xs font-bold uppercase text-[#f7e680] backdrop-blur">
                Bay Area window cleaning
              </p>
              <h1 className={`${heroFont.className} mt-4 max-w-4xl text-4xl leading-tight text-white sm:text-6xl lg:text-7xl`}>
                A1 Parola Window Cleaning
              </h1>
              <p className="mt-5 max-w-2xl text-base font-medium text-slate-100 sm:text-xl">
                Professional window cleaning across the Bay Area. Booking totals use an estimated $20 per window,
                with the final price confirmed after the job is reviewed or completed.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/book"
                  className="min-h-12 rounded-lg bg-[#D0B830] px-5 py-3 text-sm font-black text-[#080704] shadow-[0_0_26px_rgba(208,184,48,0.34)]"
                >
                  Schedule Service
                </Link>
                <Link
                  href="/customer/login"
                  className="min-h-12 rounded-lg border border-white/40 bg-white/15 px-5 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
                >
                  Customer Portal
                </Link>
                <Link
                  href="/team/sign-in"
                  className="min-h-12 rounded-lg border border-transparent px-4 py-3 text-sm font-semibold text-[#f7e680] underline-offset-2 hover:underline"
                >
                  Team Sign-In
                </Link>
              </div>
              <div className="mt-7 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
                <StatPill label="Estimated rate" value="$20/window" dark />
                <StatPill label="Service area" value="Bay Area" dark />
                <StatPill label="Payment" value="After job" dark />
              </div>
            </article>
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <section className="grid gap-4 lg:grid-cols-3">
          {serviceCards.map((card, index) => (
            <article
              key={card.title}
              className="landing-rise landing-card rounded-lg border border-[#D0B830]/30 p-5 [animation-delay:calc(120ms+80ms*var(--index))]"
              style={{ ["--index" as string]: index } as CSSProperties}
            >
              <h2 className="text-lg font-bold text-slate-950">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">{card.detail}</p>
            </article>
          ))}
        </section>

        <section className="neon-panel mt-8 rounded-lg p-5 sm:p-6">
          <h3 className={`${heroFont.className} text-3xl text-slate-900`}>How It Works</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {processSteps.map((step) => (
              <article key={step.title} className="rounded-lg border border-[#D0B830]/30 bg-white p-4">
                <p className="text-sm font-bold text-slate-900">{step.title}</p>
                <p className="mt-2 text-sm text-slate-600">{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="neon-panel mt-8 rounded-lg p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase text-[#8a7211]">Bay Area service area</p>
              <h3 className={`${heroFont.className} mt-1 text-3xl text-slate-900`}>
                Residential window cleaning near you
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                A1 Parola schedules window cleaning across the Bay Area, including San Jose,
                Santa Clara, Sunnyvale, Mountain View, Palo Alto, Fremont, Oakland, San Francisco,
                and nearby neighborhoods.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {serviceAreas.map((area) => (
                <span
                  key={area}
                  className="rounded-lg border border-[#D0B830]/30 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="neon-dark-panel mt-8 rounded-lg p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase text-[#f7e680]">
                Ready for cleaner windows?
              </p>
              <h4 className={`${heroFont.className} mt-1 text-3xl`}>Book A1 Parola online.</h4>
              <p className="mt-2 max-w-2xl text-sm text-slate-200">
                Returning customer? Use your portal to manage upcoming visits and reschedule appointments.
              </p>
              {contactItems.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#f7e680]">
                  {contactItems.map((item) => (
                    <a key={item.href} href={item.href} className="underline-offset-2 hover:underline">
                      {item.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/book"
                className="min-h-11 rounded-lg bg-[#D0B830] px-4 py-2 text-sm font-black text-[#080704] shadow-[0_0_24px_rgba(208,184,48,0.34)]"
              >
                Book Service
              </Link>
              <Link
                href="/customer/portal"
                className="min-h-11 rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold text-white"
              >
                Customer Portal
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatPill({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={dark ? "rounded-lg border border-white/20 bg-slate-950/55 px-2 py-2 shadow-sm backdrop-blur sm:px-3" : "rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-sm sm:px-3"}>
      <p className={dark ? "text-[10px] font-semibold uppercase leading-tight text-[#f7e680] sm:text-xs" : "text-[10px] font-semibold uppercase leading-tight text-slate-500 sm:text-xs"}>{label}</p>
      <p className={dark ? "mt-1 text-base font-bold leading-tight text-white sm:text-lg" : "mt-1 text-base font-bold leading-tight text-slate-900 sm:text-lg"}>{value}</p>
    </div>
  );
}
