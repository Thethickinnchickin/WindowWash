import type { CSSProperties } from "react";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getCustomerSessionAccount } from "@/lib/customer-auth";

const heroFont = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const serviceCards = [
  {
    title: "Residential Window Care",
    detail: "Inside and outside glass, tracks, and screen detail clean.",
  },
  {
    title: "Storefront & Office",
    detail: "Reliable recurring service windows before your business opens.",
  },
  {
    title: "Hard Water Spot Removal",
    detail: "Restoration pass for etched buildup and stubborn mineral haze.",
  },
];

const processSteps = [
  {
    title: "1. Choose Your Start Time",
    detail: "Pick the date/time that works for you, then confirm your address and service notes.",
  },
  {
    title: "2. Track Your Crew",
    detail: "Get updates when your technician is on the way, in progress, and complete.",
  },
  {
    title: "3. Pay Your Way",
    detail: "Pay online, on-site, cash/check, or use your saved card for faster checkout.",
  },
];

export default async function HomePage() {
  const [staffUser, customerAccount] = await Promise.all([
    getSessionUser(),
    getCustomerSessionAccount(),
  ]);

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
      <div className="landing-orb landing-orb-top pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full blur-3xl" />
      <div className="landing-orb landing-orb-bottom pointer-events-none absolute -left-28 bottom-20 h-[20rem] w-[20rem] rounded-full blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="landing-rise flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/60 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--landing-accent)] text-sm font-extrabold text-white">
              WW
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Window Wash Co</p>
              <p className="text-sm font-semibold text-slate-800">Sparkling glass, stress-free scheduling</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/customer/login"
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Customer Login
            </Link>
            <Link
              href="/book"
              className="min-h-11 rounded-xl bg-[var(--landing-accent)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25"
            >
              Book Now
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="landing-rise [animation-delay:120ms]">
            <p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-cyan-800">
              Fast, insured, trusted local team
            </p>
            <h1 className={`${heroFont.className} mt-4 text-4xl leading-tight text-slate-900 sm:text-5xl lg:text-6xl`}>
              Make your windows the brightest part of the block.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-700 sm:text-lg">
              Book in under two minutes, get live technician updates, and pay the way you prefer. Built for homes,
              storefronts, and recurring commercial stops.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/book"
                className="min-h-11 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-slate-900/20"
              >
                Schedule Appointment
              </Link>
              <Link
                href="/customer/register"
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Create Customer Account
              </Link>
              <Link
                href="/team/sign-in"
                className="min-h-11 rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-600 underline-offset-2 hover:underline"
              >
                Team Sign-In
              </Link>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <StatPill label="Avg. response" value="< 5 min" />
              <StatPill label="Customer rating" value="4.9/5" />
              <StatPill label="Support window" value="7 days/wk" />
            </div>
          </article>

          <aside className="landing-rise [animation-delay:240ms]">
            <div className="landing-card rounded-3xl border border-white/60 p-4 shadow-2xl shadow-cyan-900/10 sm:p-5">
              <p className="text-sm font-bold uppercase tracking-[0.1em] text-slate-500">Results You Can See</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <BeforeAfterCard title="Before" tone="before" />
                <BeforeAfterCard title="After" tone="after" />
              </div>
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                Your technician sends status updates and completion proof in real time.
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          {serviceCards.map((card, index) => (
            <article
              key={card.title}
              className="landing-rise landing-card rounded-2xl border border-white/60 p-4 [animation-delay:calc(300ms+80ms*var(--index))]"
              style={{ ["--index" as string]: index } as CSSProperties}
            >
              <h2 className="text-base font-bold text-slate-900">{card.title}</h2>
              <p className="mt-2 text-sm text-slate-700">{card.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/65 p-5 backdrop-blur-sm sm:p-6">
          <h3 className={`${heroFont.className} text-3xl text-slate-900`}>How It Works</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {processSteps.map((step) => (
              <article key={step.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-900">{step.title}</p>
                <p className="mt-2 text-sm text-slate-600">{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl bg-slate-900 p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-cyan-200">
                Ready for crystal-clear glass?
              </p>
              <h4 className={`${heroFont.className} mt-1 text-3xl`}>Lock your appointment now.</h4>
              <p className="mt-2 max-w-2xl text-sm text-slate-200">
                Returning customer? Use your portal to manage upcoming visits, reschedule, and keep payment info on
                file.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/book"
                className="min-h-11 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-900"
              >
                Start Booking
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
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function BeforeAfterCard({ title, tone }: { title: string; tone: "before" | "after" }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className={`h-32 w-full ${tone === "before" ? "landing-before" : "landing-after"}`} />
      <div className="p-3">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{title}</p>
        <p className="mt-1 text-xs text-slate-600">
          {tone === "before"
            ? "Water marks and track buildup"
            : "Clear glass, detailed edges, polished finish"}
        </p>
      </div>
    </div>
  );
}
