import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { NeonLogo } from "@/components/brand/neon-logo";
import { PublicFooter } from "@/components/public/public-footer";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of service for A1 Parola Window & Gutter Cleaning estimates, appointments, payments, and customer portal use.",
  alternates: {
    canonical: "/terms",
  },
};

const lastUpdated = "September 23, 2026";

export default function TermsPage() {
  return (
    <main className="neon-page-bg min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="neon-panel rounded-2xl p-5 sm:p-6">
          <Link href="/" aria-label="A1 Parola home" className="inline-flex">
            <NeonLogo compact />
          </Link>
          <p className="mt-5 text-sm font-black uppercase text-[#8a7211]">Terms of Service</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950 sm:text-4xl">
            Terms for booking and using A1 Parola services
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">Last updated: {lastUpdated}</p>
        </header>

        <section className="mt-5 space-y-5 rounded-2xl border border-[#D0B830]/30 bg-white p-5 text-sm leading-7 text-slate-700 shadow-sm sm:p-6">
          <LegalSection title="Estimates and Final Pricing">
            <p>
              Online booking totals are estimates based on the information provided, including
              estimated window count and gutter linear footage. Final pricing may change after the
              job is reviewed or completed.
            </p>
          </LegalSection>

          <LegalSection title="Appointments">
            <p>
              Appointment times are scheduled based on worker availability and may need to be
              adjusted for weather, access issues, job length, traffic, safety, or other operational
              reasons. A1 Parola may contact you to confirm or update appointment details.
            </p>
          </LegalSection>

          <LegalSection title="Customer Responsibilities">
            <p>
              Customers are responsible for providing accurate contact information, service address,
              access instructions, and job details. Please make sure workers can safely access the
              service area at the scheduled time.
            </p>
          </LegalSection>

          <LegalSection title="Payment">
            <p>
              Payment is handled after the job is completed. When a job is marked paid, A1 Parola may
              send a receipt by email and make that receipt available in the customer portal.
            </p>
          </LegalSection>

          <LegalSection title="Customer Portal">
            <p>
              Customer portal accounts are for managing appointments and viewing job records. Keep
              login information private and contact A1 Parola if account information needs to be
              corrected.
            </p>
          </LegalSection>

          <LegalSection title="Cancellations and Rescheduling">
            <p>
              Customers may request cancellation or rescheduling through the portal when available.
              Some requests may require direct follow-up from A1 Parola depending on timing,
              scheduling, or business policy.
            </p>
          </LegalSection>

          <LegalSection title="Contact">
            <p>
              Questions about these terms can be sent to{" "}
              {env.COMPANY_CONTACT_EMAIL ? (
                <a className="font-semibold text-[#8a7211] underline" href={`mailto:${env.COMPANY_CONTACT_EMAIL}`}>
                  {env.COMPANY_CONTACT_EMAIL}
                </a>
              ) : (
                "A1 Parola"
              )}
              {env.COMPANY_CONTACT_PHONE ? <> or {env.COMPANY_CONTACT_PHONE}</> : null}.
            </p>
          </LegalSection>
        </section>
      </div>
      <PublicFooter />
    </main>
  );
}

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
