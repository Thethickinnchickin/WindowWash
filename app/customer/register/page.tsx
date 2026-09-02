import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerRegisterForm } from "@/components/public/customer-register-form";
import { getCustomerSessionAccount } from "@/lib/customer-auth";
import { NeonLogo } from "@/components/brand/neon-logo";

export default async function CustomerRegisterPage() {
  const account = await getCustomerSessionAccount();

  if (account) {
    redirect("/customer/portal");
  }

  return (
    <main className="neon-page-bg flex min-h-screen items-center justify-center p-3 sm:p-4 md:p-6">
      <section className="neon-panel w-full max-w-lg rounded-3xl p-5 sm:p-6 md:p-7">
        <NeonLogo />
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Create Customer Account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create an account now without booking an appointment.
        </p>
        <div className="mt-6">
          <CustomerRegisterForm />
        </div>
        <div className="mt-6 rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-sm text-slate-700">
          Already have an account?{" "}
          <Link href="/customer/login" className="font-semibold text-fuchsia-700 underline">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
