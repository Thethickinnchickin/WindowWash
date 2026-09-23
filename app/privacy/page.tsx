import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { NeonLogo } from "@/components/brand/neon-logo";
import { PublicFooter } from "@/components/public/public-footer";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy policy for A1 Parola Window & Gutter Cleaning customer information, appointment details, and email communications.",
  alternates: {
    canonical: "/privacy",
  },
};

const lastUpdated = "September 23, 2026";

export default function PrivacyPage() {
  return (
    <main className="neon-page-bg min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="neon-panel rounded-2xl p-5 sm:p-6">
          <Link href="/" aria-label="A1 Parola home" className="inline-flex">
            <NeonLogo compact />
          </Link>
          <p className="mt-5 text-sm font-black uppercase text-[#8a7211]">Privacy Policy</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950 sm:text-4xl">
            How A1 Parola handles customer information
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">Last updated: {lastUpdated}</p>
        </header>

        <section className="mt-5 space-y-5 rounded-2xl border border-[#D0B830]/30 bg-white p-5 text-sm leading-7 text-slate-700 shadow-sm sm:p-6">
          <LegalSection title="Information We Collect">
            <p>
              When you book service, create a customer account, contact us, or use the customer
              portal, we may collect your name, email address, phone number, service address,
              appointment details, job notes, payment status, and messages related to your service.
            </p>
          </LegalSection>

          <LegalSection title="How We Use Information">
            <p>
              We use customer information to schedule and manage appointments, send appointment
              confirmations and reminders, contact you about service, prepare estimates, record
              completed work, send receipts, and maintain customer portal access.
            </p>
          </LegalSection>

          <LegalSection title="Email and Communications">
            <p>
              If you provide an email address, A1 Parola may send appointment confirmations,
              reminders, updates, and receipts. You can contact us to update your information or ask
              us to stop non-essential messages.
            </p>
          </LegalSection>

          <LegalSection title="Photos and Job Records">
            <p>
              Workers may add job notes or photos for operational records. Public before-and-after
              photos are only published with customer approval.
            </p>
          </LegalSection>

          <LegalSection title="Sharing Information">
            <p>
              We do not sell customer information. We may use service providers for hosting, email,
              analytics, storage, and business operations. We may also share information if required
              by law or to protect the business, customers, or workers.
            </p>
          </LegalSection>

          <LegalSection title="Data Security">
            <p>
              We use reasonable safeguards to protect customer information, but no website or online
              service can guarantee complete security. Keep customer portal passwords private.
            </p>
          </LegalSection>

          <LegalSection title="Contact">
            <p>
              Questions about this policy can be sent to{" "}
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
