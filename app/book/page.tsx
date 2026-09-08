import type { Metadata } from "next";
import { AppointmentBookingForm } from "@/components/public/appointment-booking-form";
import { getSessionUser } from "@/lib/auth";
import { getCustomerSessionAccount } from "@/lib/customer-auth";
import { env } from "@/lib/env";
import Link from "next/link";
import { NeonLogo } from "@/components/brand/neon-logo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book Window Cleaning",
  description:
    "Schedule Bay Area window cleaning with A1 Parola. Enter your window count for an estimated total, choose an appointment time, and pay after completion.",
  alternates: {
    canonical: "/book",
  },
  openGraph: {
    title: "Book Window Cleaning | A1 Parola",
    description:
      "Book residential window cleaning online with A1 Parola. Estimated $20 per window pricing and payment after completion.",
    url: "/book",
  },
};

export default async function BookPage() {
  const [account, staffSession] = await Promise.all([
    getCustomerSessionAccount(),
    getSessionUser(),
  ]);
  const contactItems = [
    env.COMPANY_CONTACT_PHONE ? { label: env.COMPANY_CONTACT_PHONE, href: `tel:${env.COMPANY_CONTACT_PHONE}` } : null,
    env.COMPANY_CONTACT_EMAIL ? { label: env.COMPANY_CONTACT_EMAIL, href: `mailto:${env.COMPANY_CONTACT_EMAIL}` } : null,
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <main className="neon-page-bg min-h-screen px-3 py-4 sm:px-4 sm:py-6 md:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="neon-panel mb-4 rounded-2xl p-4 backdrop-blur-sm sm:p-5">
          <NeonLogo />
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl">Book Window Service</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-700 sm:text-base">
            Enter the number of windows to get an estimate using $20 per window. The total shown is an estimate
            until the job is reviewed or completed, and payment is handled after the job is completed.
          </p>
          {contactItems.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
              {contactItems.map((item) => (
                <a key={item.href} href={item.href} className="font-semibold text-[#8a7211] underline">
                  {item.label}
                </a>
              ))}
            </div>
          ) : null}
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {account ? (
              <div className="rounded-xl border border-[#D0B830]/35 bg-[#fffaf0] p-3">
                <p className="text-xs font-bold uppercase text-slate-900">Signed In</p>
                <p className="text-sm text-[#5f5947]">
                  Booking as {account.customer.name} ({account.email}).
                </p>
                <Link
                  href="/customer/portal"
                  className="neon-button mt-2 inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-black"
                >
                  Open Customer Portal
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-[#D0B830]/35 bg-[#fffaf0] p-3">
                <p className="text-xs font-bold uppercase text-slate-900">Returning Customer</p>
                <p className="text-sm text-[#5f5947]">Sign in to use your saved customer details.</p>
                <Link
                  href="/customer/login"
                  className="neon-button mt-2 inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-black"
                >
                  Customer Login
                </Link>
              </div>
            )}
            <div className="rounded-xl border border-[#D0B830]/35 bg-white p-3">
              <p className="text-xs font-bold uppercase text-[#8a7211]">New or Guest Booking</p>
              <p className="text-sm text-[#5f5947]">
                Fill out the form below. You can create an account during booking.
              </p>
            </div>
          </div>
          {!account && staffSession ? (
            <p className="mt-2 text-xs text-amber-800">
              You are signed in as staff ({staffSession.email}). Customer autofill requires a customer
              login at /customer/login.
            </p>
          ) : null}
        </header>
        <AppointmentBookingForm initialAccount={account} />
      </div>
    </main>
  );
}
