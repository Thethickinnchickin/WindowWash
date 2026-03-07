import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerRegisterForm } from "@/components/public/customer-register-form";
import { getCustomerSessionAccount } from "@/lib/customer-auth";

export default async function CustomerRegisterPage() {
  const account = await getCustomerSessionAccount();

  if (account) {
    redirect("/customer/portal");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-100 via-white to-sky-100 p-3 sm:p-4 md:p-6">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6 md:p-7">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Window Wash Co</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Create Customer Account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create an account now without booking an appointment.
        </p>
        <div className="mt-6">
          <CustomerRegisterForm />
        </div>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          Already have an account?{" "}
          <Link href="/customer/login" className="font-semibold text-sky-700 underline">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
