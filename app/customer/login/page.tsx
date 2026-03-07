import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerLoginForm } from "@/components/public/customer-login-form";
import { getCustomerSessionAccount } from "@/lib/customer-auth";

export default async function CustomerLoginPage() {
  const account = await getCustomerSessionAccount();

  if (account) {
    redirect("/customer/portal");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-100 via-white to-sky-100 p-3 sm:p-4 md:p-6">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6 md:p-7">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Window Wash Co</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Returning Customer Login</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sign in to book faster and reuse your saved card.
        </p>
        <div className="mt-6">
          <CustomerLoginForm />
        </div>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          New here? {" "}
          <Link href="/customer/register" className="font-semibold text-sky-700 underline">
            Create account
          </Link>
          {" "}or{" "}
          <Link href="/book" className="font-semibold text-sky-700 underline">
            book as guest
          </Link>
        </div>
      </section>
    </main>
  );
}
