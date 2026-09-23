import type { Metadata } from "next";
import Link from "next/link";
import { NeonLogo } from "@/components/brand/neon-logo";
import { PublicFooter } from "@/components/public/public-footer";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Appointment Request Received",
  description: "A1 Parola received your window or gutter cleaning appointment request.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BookingConfirmationPage() {
  return (
    <main className="neon-page-bg min-h-screen px-3 py-4 sm:px-4 sm:py-6 md:px-6">
      <section className="neon-panel mx-auto max-w-2xl rounded-3xl p-5 sm:p-7">
        <Link href="/" aria-label="A1 Parola home" className="inline-flex">
          <NeonLogo />
        </Link>
        <p className="mt-6 text-sm font-black uppercase text-[#8a7211]">Appointment request received</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">
          Thanks. Your request has been submitted.
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-700">
          A1 Parola received your appointment request. You should receive an email confirmation with
          the appointment details. Payment is handled after the job is completed.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/book"
            data-analytics-event="book_service_click"
            data-analytics-category="conversion"
            data-analytics-location="booking_confirmation"
            className="neon-button inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-black"
          >
            Book Another Service
          </Link>
          <Link
            href="/customer/login"
            data-analytics-event="customer_login_click"
            data-analytics-category="engagement"
            data-analytics-location="booking_confirmation"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#D0B830]/45 bg-white px-4 py-2 text-sm font-bold text-[#8a7211]"
          >
            Customer Portal
          </Link>
        </div>

        {env.COMPANY_CONTACT_PHONE || env.COMPANY_CONTACT_EMAIL ? (
          <div className="mt-6 rounded-2xl border border-[#D0B830]/30 bg-[#fffaf0] p-4 text-sm text-slate-700">
            <p className="font-bold text-slate-950">Need to change something?</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {env.COMPANY_CONTACT_PHONE ? (
                <a
                  href={`tel:${env.COMPANY_CONTACT_PHONE}`}
                  data-analytics-event="phone_click"
                  data-analytics-category="lead"
                  data-analytics-location="booking_confirmation"
                  className="font-semibold text-[#8a7211] underline"
                >
                  {env.COMPANY_CONTACT_PHONE}
                </a>
              ) : null}
              {env.COMPANY_CONTACT_EMAIL ? (
                <a
                  href={`mailto:${env.COMPANY_CONTACT_EMAIL}`}
                  data-analytics-event="email_click"
                  data-analytics-category="lead"
                  data-analytics-location="booking_confirmation"
                  className="font-semibold text-[#8a7211] underline"
                >
                  {env.COMPANY_CONTACT_EMAIL}
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
      <PublicFooter />
    </main>
  );
}
