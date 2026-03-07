import { AppointmentBookingForm } from "@/components/public/appointment-booking-form";
import { getSessionUser } from "@/lib/auth";
import { getCustomerSessionAccount } from "@/lib/customer-auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const [account, staffSession] = await Promise.all([
    getCustomerSessionAccount(),
    getSessionUser(),
  ]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-cyan-100 via-white to-sky-100 px-3 py-4 sm:px-4 sm:py-6 md:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Window Wash Co</p>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl">Book Window Service</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-700 sm:text-base">
            Schedule as guest or create an account, and optionally save card details for faster payment.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {account ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase text-emerald-700">Signed In</p>
                <p className="text-sm text-emerald-900">
                  Booking as {account.customer.name} ({account.email}).
                </p>
                <Link
                  href="/customer/portal"
                  className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                >
                  Open Customer Portal
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase text-emerald-700">Returning Customer</p>
                <p className="text-sm text-emerald-900">Sign in to use your saved info and cards.</p>
                <Link
                  href="/customer/login"
                  className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                >
                  Customer Login
                </Link>
              </div>
            )}
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
              <p className="text-xs font-semibold uppercase text-sky-700">New or Guest Booking</p>
              <p className="text-sm text-sky-900">
                Fill out the form below. You can create an account during booking.
              </p>
            </div>
          </div>
          {!account && staffSession ? (
            <p className="mt-2 text-xs text-amber-800">
              You are signed in as staff ({staffSession.email}). Customer autofill and saved-card
              prepay require a customer login at /customer/login.
            </p>
          ) : null}
        </header>
        <AppointmentBookingForm initialAccount={account} />
      </div>
    </main>
  );
}
