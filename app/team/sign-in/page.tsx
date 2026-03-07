import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function TeamSignInPage() {
  const user = await getSessionUser();

  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/worker/today");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 via-white to-cyan-100 p-3 sm:p-4 md:p-6">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6 md:p-7">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Window Wash Co</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Team Sign In</h1>
        <p className="mt-1 text-sm text-slate-600">Use your worker or admin account.</p>
        <p className="mt-1 text-sm text-slate-600">
          Customer booking:{" "}
          <Link href="/book" className="font-semibold text-sky-700 underline">
            schedule appointment
          </Link>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Returning customer?{" "}
          <Link href="/customer/login" className="font-semibold text-sky-700 underline">
            customer login
          </Link>
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
