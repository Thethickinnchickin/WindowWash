import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerLoginForm } from "@/components/public/customer-login-form";
import { getCustomerSessionAccount } from "@/lib/customer-auth";
import { NeonLogo } from "@/components/brand/neon-logo";

export default async function CustomerLoginPage() {
  const account = await getCustomerSessionAccount();

  if (account) {
    redirect("/customer/portal");
  }

  return (
    <main className="neon-page-bg flex min-h-screen items-center justify-center p-3 sm:p-4 md:p-6">
      <section className="neon-panel w-full max-w-lg rounded-3xl p-5 sm:p-6 md:p-7">
        <NeonLogo />
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Customer Portal Login</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sign in to review appointments and reschedule or cancel visits.
        </p>
        <div className="mt-6">
          <CustomerLoginForm />
        </div>
        <div className="mt-6 rounded-xl border border-[#D0B830]/30 bg-[#fffaf0] p-3 text-sm text-slate-700">
          New here? {" "}
          <Link href="/customer/register" className="font-semibold text-[#8a7211] underline">
            Create account
          </Link>
          {" "}or{" "}
          <Link href="/book" className="font-semibold text-[#8a7211] underline">
            book as guest
          </Link>
        </div>
      </section>
    </main>
  );
}
