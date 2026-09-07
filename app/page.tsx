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

const serviceCards = [
  {
    title: "Window Cleaning",
    detail: "Interior and exterior glass cleaning with tracks, screens, and detail work available.",
  },
  {
    title: "Gutter Cleaning",
    detail: "Clear debris from gutters and downspouts so water moves away from the home.",
  },
  {
    title: "Solar Panel Cleaning",
    detail: "Clean panel surfaces so dirt, dust, and buildup are not blocking sunlight.",
  },
];

const roleCards = [
  {
    title: "Homes",
    detail: "Window cleaning for houses, townhomes, and rental properties across the Bay Area.",
    bullets: ["Exterior glass", "Interior panes", "Screens and tracks"],
    href: "/book",
    actionLabel: "Book home service",
  },
  {
    title: "Commercial",
    detail: "Reliable glass cleaning for storefronts, offices, and recurring business stops.",
    bullets: ["Storefront windows", "Recurring visits", "Simple scheduling"],
    href: "/book",
    actionLabel: "Schedule commercial service",
  },
  {
    title: "Exterior Care",
    detail: "Add gutter cleaning, solar panel cleaning, and hard-water spot work when needed.",
    bullets: ["Gutters", "Solar panels", "Hard-water spots"],
    href: "/book",
    actionLabel: "Get on the schedule",
  },
];

const processSteps = [
  {
    title: "1. Choose Service",
    detail: "Tell us what needs cleaning and add any notes about access, screens, tracks, or hard water.",
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--landing-bg)] text-[var(--landing-ink)]">
      <div className="landing-grid pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="landing-rise neon-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 backdrop-blur-sm">
          <NeonLogo label="A1 Parola" tagline="Windows, gutters, and solar cleaning" />
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/customer/login"
              className="min-h-11 rounded-xl border border-cyan-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
            >
              Customer Login
            </Link>
            <Link
              href="/book"
              className="neon-button min-h-11 rounded-xl px-4 py-2 text-sm font-black"
            >
              Book Service
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="landing-rise [animation-delay:120ms]">
            <p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold uppercase text-cyan-800 shadow-[0_0_22px_rgba(0,213,255,0.18)]">
              Bay Area window, gutter, and solar cleaning
            </p>
            <h1 className={`${heroFont.className} mt-4 text-4xl leading-tight text-slate-900 sm:text-5xl lg:text-6xl`}>
              A1 Parola Windows, Gutters & Solar Cleaning
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-700 sm:text-lg">
              Professional cleaning for homes and small businesses. Book online, get email updates, and pay after
              the job is completed.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/book"
                className="neon-button min-h-11 rounded-xl px-5 py-3 text-sm font-black"
              >
                Schedule Service
              </Link>
              <Link
                href="/customer/login"
                className="min-h-11 rounded-xl border border-cyan-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800"
              >
                Customer Portal
              </Link>
              <Link
                href="/team/sign-in"
                className="min-h-11 rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-600 underline-offset-2 hover:underline"
              >
                Team Sign-In
              </Link>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <StatPill label="Service area" value="Bay Area" />
              <StatPill label="Services" value="3 core" />
              <StatPill label="Payment" value="After job" />
            </div>
          </article>

          <aside className="landing-rise [animation-delay:240ms]">
            <div className="landing-card overflow-hidden rounded-3xl border border-cyan-100 p-4 sm:p-5">
              <div className="relative min-h-[320px] overflow-hidden rounded-2xl border border-cyan-100 sm:min-h-[420px]">
                <Image
                  src="/a1parola-hero.png"
                  alt="Clean home exterior with bright windows, gutters, and solar panels"
                  fill
                  priority
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="mt-4 rounded-2xl border border-lime-200 bg-lime-50 p-3 text-sm font-semibold text-slate-900">
                Online booking sends customers appointment confirmation and day-of reminder emails.
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {roleCards.map((card) => (
            <article key={card.title} className="landing-rise rounded-3xl border border-cyan-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
              <p className="text-sm font-bold uppercase text-fuchsia-700">{card.title}</p>
              <h2 className="mt-2 text-lg font-bold text-slate-900">{card.detail}</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {card.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-lime-400 shadow-[0_0_12px_rgba(163,255,18,0.8)]" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={card.href}
                className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-cyan-200 px-4 py-2 text-sm font-bold text-slate-800"
              >
                {card.actionLabel}
              </Link>
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          {serviceCards.map((card, index) => (
            <article
              key={card.title}
              className="landing-rise landing-card rounded-2xl border border-cyan-100 p-4 [animation-delay:calc(300ms+80ms*var(--index))]"
              style={{ ["--index" as string]: index } as CSSProperties}
            >
              <h2 className="text-base font-bold text-slate-900">{card.title}</h2>
              <p className="mt-2 text-sm text-slate-700">{card.detail}</p>
            </article>
          ))}
        </section>

        <section className="neon-panel mt-8 rounded-3xl p-5 backdrop-blur-sm sm:p-6">
          <h3 className={`${heroFont.className} text-3xl text-slate-900`}>How It Works</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {processSteps.map((step) => (
              <article key={step.title} className="rounded-2xl border border-cyan-100 bg-white p-4">
                <p className="text-sm font-bold text-slate-900">{step.title}</p>
                <p className="mt-2 text-sm text-slate-600">{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="neon-dark-panel mt-8 rounded-3xl p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase text-cyan-200">
                Ready for cleaner glass, gutters, and solar panels?
              </p>
              <h4 className={`${heroFont.className} mt-1 text-3xl`}>Book A1 Parola online.</h4>
              <p className="mt-2 max-w-2xl text-sm text-slate-200">
                Returning customer? Use your portal to manage upcoming visits and reschedule appointments.
              </p>
              {contactItems.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-cyan-100">
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
                className="min-h-11 rounded-xl bg-lime-300 px-4 py-2 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(163,255,18,0.35)]"
              >
                Book Service
              </Link>
              <Link
                href="/customer/portal"
                className="min-h-11 rounded-xl border border-slate-500 px-4 py-2 text-sm font-semibold text-white"
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

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
