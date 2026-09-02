"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, rememberMe }),
    });

    const json = await response.json();

    if (!response.ok) {
      setSubmitting(false);
      setError(json.error?.message || "Unable to sign in");
      return;
    }

    const me = await fetch("/api/auth/me", { credentials: "include" });
    const meJson = await me.json();
    const role = meJson.data?.user?.role;

    setSubmitting(false);

    if (role === "admin") {
      router.replace("/admin");
      return;
    }

    router.replace("/worker/today");
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-cyan-200 bg-white px-3 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200"
          placeholder="you@company.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-cyan-200 bg-white px-3 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200"
          placeholder="Enter password"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700" htmlFor="rememberMe">
        <input
          id="rememberMe"
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
          className="h-4 w-4"
        />
        Remember me
      </label>

      {error ? <p className="rounded-xl bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="neon-button min-h-11 w-full rounded-xl px-4 py-2 text-sm font-black disabled:bg-slate-400 disabled:text-white"
      >
        {submitting ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
