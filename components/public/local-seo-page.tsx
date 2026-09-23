import Image from "next/image";
import Link from "next/link";
import { NeonLogo } from "@/components/brand/neon-logo";
import { env } from "@/lib/env";
import type { LocalSeoPageConfig } from "@/lib/local-seo-pages";

const siteUrl = (process.env.APP_BASE_URL ?? "https://www.a1parola.com").replace(/\/$/, "");

export function LocalSeoPage({ page }: { page: LocalSeoPageConfig }) {
  const pageUrl = `${siteUrl}/${page.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${pageUrl}#service`,
    name: `${page.serviceTitle} in ${page.city}`,
    serviceType: page.serviceTitle,
    description: page.description,
    url: pageUrl,
    provider: {
      "@type": "LocalBusiness",
      "@id": `${siteUrl}/#business`,
      name: "A1 Parola Window & Gutter Cleaning",
      telephone: env.COMPANY_CONTACT_PHONE,
      email: env.COMPANY_CONTACT_EMAIL,
      image: `${siteUrl}/a1parola-window-hero.png`,
      logo: `${siteUrl}/a1parola-logo.svg`,
    },
    areaServed: {
      "@type": page.city === "Bay Area" ? "AdministrativeArea" : "City",
      name: page.city,
    },
    offers: {
      "@type": "Offer",
      name: page.estimate,
      priceCurrency: "USD",
      description: page.estimateDetail,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <main className="min-h-screen bg-[var(--landing-bg)] text-[var(--landing-ink)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <section className="relative overflow-hidden text-white">
        <Image
          src="/a1parola-window-hero.png"
          alt="A clean residential window"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,7,4,0.94),rgba(8,7,4,0.7)_52%,rgba(8,7,4,0.24))]" />
        <div className="relative mx-auto flex min-h-[62svh] max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/20 pb-4">
            <Link href="/" aria-label="A1 Parola home">
              <NeonLogo compact />
            </Link>
            <nav className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="min-h-11 rounded-lg border border-white/35 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
              >
                Home
              </Link>
              <Link
                href="/book"
                className="min-h-11 rounded-lg bg-[#D0B830] px-4 py-2 text-sm font-black text-[#080704] shadow-[0_0_26px_rgba(208,184,48,0.34)]"
              >
                Book Service
              </Link>
            </nav>
          </header>

          <article className="flex flex-1 flex-col justify-center py-12">
            <p className="inline-flex w-fit rounded-full border border-[#D0B830]/60 bg-[#080704]/65 px-3 py-1 text-xs font-bold uppercase text-[#f7e680] backdrop-blur">
              {page.eyebrow}
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight text-white sm:text-6xl">
              {page.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-100 sm:text-xl">
              {page.description}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/book"
                data-analytics-event="book_service_click"
                data-analytics-category="conversion"
                data-analytics-location={page.slug}
                className="min-h-12 rounded-lg bg-[#D0B830] px-5 py-3 text-sm font-black text-[#080704] shadow-[0_0_26px_rgba(208,184,48,0.34)]"
              >
                Schedule {page.serviceTitle}
              </Link>
              {env.COMPANY_CONTACT_PHONE ? (
                <a
                  href={`tel:${env.COMPANY_CONTACT_PHONE}`}
                  data-analytics-event="phone_click"
                  data-analytics-category="lead"
                  data-analytics-location={page.slug}
                  className="min-h-12 rounded-lg border border-white/40 bg-white/15 px-5 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
                >
                  Call {env.COMPANY_CONTACT_PHONE}
                </a>
              ) : null}
            </div>
          </article>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid gap-4 lg:grid-cols-3">
          <article className="landing-card rounded-lg border border-[#D0B830]/30 p-5">
            <h2 className="text-lg font-bold text-slate-950">{page.estimate}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{page.estimateDetail}</p>
          </article>
          <article className="landing-card rounded-lg border border-[#D0B830]/30 p-5">
            <h2 className="text-lg font-bold text-slate-950">Local scheduling</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Choose an appointment online and get email updates for your {page.service} visit.
            </p>
          </article>
          <article className="landing-card rounded-lg border border-[#D0B830]/30 p-5">
            <h2 className="text-lg font-bold text-slate-950">Pay after completion</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Payment is handled after the job is completed and the final total has been reviewed.
            </p>
          </article>
        </section>

        <section className="neon-panel mt-8 rounded-lg p-5 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-sm font-black uppercase text-[#8a7211]">What to expect</p>
              <h2 className="mt-1 text-3xl font-black text-slate-900">
                Simple {page.service} for {page.city}
              </h2>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                {page.highlights.map((highlight) => (
                  <li key={highlight} className="rounded-lg border border-[#D0B830]/25 bg-white px-3 py-2">
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-black uppercase text-[#8a7211]">Nearby areas</p>
              <h2 className="mt-1 text-3xl font-black text-slate-900">Serving the surrounding area</h2>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {page.nearbyAreas.map((area) => (
                  <span
                    key={area}
                    className="rounded-lg border border-[#D0B830]/30 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="neon-dark-panel mt-8 rounded-lg p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase text-[#f7e680]">A1 Parola</p>
              <h2 className="mt-1 text-3xl font-black">Book {page.service} online.</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-200">
                Get an estimate before submitting the appointment. Final price may change after review
                or completion.
              </p>
            </div>
            <Link
              href="/book"
              data-analytics-event="book_service_click"
              data-analytics-category="conversion"
              data-analytics-location={`${page.slug}_footer`}
              className="min-h-11 rounded-lg bg-[#D0B830] px-4 py-2 text-sm font-black text-[#080704] shadow-[0_0_24px_rgba(208,184,48,0.34)]"
            >
              Book Service
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
