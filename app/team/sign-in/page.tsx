import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";
import { NeonLogo } from "@/components/brand/neon-logo";

export default async function TeamSignInPage() {
  const user = await getSessionUser();

  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/worker/today");
  }

  return (
    <main className="neon-page-bg flex min-h-screen items-center justify-center p-3 sm:p-4 md:p-6">
      <section className="neon-panel w-full max-w-lg rounded-3xl p-5 sm:p-6 md:p-7">
        <NeonLogo />
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Admin & Worker Sign In</h1>
        <p className="mt-1 text-sm text-slate-600">Admins assign jobs and manage the schedule. Workers see their next appointment and update job status.</p>
        <p className="mt-1 text-sm text-slate-600">
          Customer booking:{" "}
          <Link href="/book" className="font-semibold text-fuchsia-700 underline">
            schedule appointment
          </Link>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Returning customer?{" "}
          <Link href="/customer/login" className="font-semibold text-fuchsia-700 underline">
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
