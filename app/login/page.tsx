import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const user = await getSessionUser();

  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/worker/today");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 via-white to-cyan-100 p-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Window Wash Co</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Team Sign In</h1>
        <p className="mt-1 text-sm text-slate-600">Use your worker or admin account.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
