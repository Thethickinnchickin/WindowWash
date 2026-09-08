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
    detail: "Window service priced simply by the total number of windows.",
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
    bullets: ["$20 per window", "Simple window count", "Online scheduling"],
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
    title: "Gutters & Solar",
    detail: "Add gutter cleaning or solar panel cleaning notes when needed.",
    bullets: ["Gutters", "Solar panels", "Job notes"],
    href: "/book",
    actionLabel: "Get on the schedule",
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

  return (
    <main className="min-h-screen bg-[var(--landing-bg)] text-[var(--landing-ink)]">
      <section className="relative min-h-[82svh] overflow-hidden text-white">
        <Image
          src="/a1parola-hero.png"
          alt="Clean home with bright windows, gutters, and solar panels"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,7,4,0.95),rgba(8,7,4,0.78)_46%,rgba(8,7,4,0.25))]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--landing-bg)] to-transparent" />

        <div className="relative mx-auto flex min-h-[82svh] max-w-7xl flex-col px-4 pb-16 pt-5 sm:px-6 lg:px-8">
          <header className="landing-rise flex flex-wrap items-center justify-between gap-3 border-b border-white/20 pb-4">
            <div className="flex items-center gap-3">
              <NeonLogo compact />
              <div>
                <p className="text-sm font-black uppercase text-white">A1 Parola</p>
                <p className="text-xs font-semibold text-[#f7e680]">Windows, gutters, and solar cleaning</p>
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
                Bay Area window, gutter, and solar cleaning
              </p>
              <h1 className={`${heroFont.className} mt-4 max-w-4xl text-4xl leading-tight text-white sm:text-6xl lg:text-7xl`}>
                A1 Parola Windows, Gutters & Solar Cleaning
              </h1>
              <p className="mt-5 max-w-2xl text-base font-medium text-slate-100 sm:text-xl">
                Professional cleaning for homes and small businesses. Window service is priced at $20 per window,
                with online scheduling, email updates, and payment after the job is completed.
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
                <StatPill label="Window cleaning" value="$20/window" dark />
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

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {roleCards.map((card) => (
            <article key={card.title} className="landing-rise rounded-lg border border-[#D0B830]/30 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold uppercase text-[#8a7211]">{card.title}</p>
              <h2 className="mt-2 text-lg font-bold text-slate-900">{card.detail}</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {card.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#D0B830] shadow-[0_0_12px_rgba(208,184,48,0.65)]" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={card.href}
                className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-[#D0B830]/45 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:border-[#D0B830]"
              >
                {card.actionLabel}
              </Link>
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

        <section className="neon-dark-panel mt-8 rounded-lg p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase text-[#f7e680]">
                Ready for cleaner glass, gutters, and solar panels?
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
