"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CustomerLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/customer/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        rememberMe,
      }),
    });

    const json = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(json.error?.message || "Unable to sign in");
      return;
    }

    router.replace("/customer/portal");
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor="customer-email">
          Email
        </label>
        <input
          id="customer-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor="customer-password">
          Password
        </label>
        <input
          id="customer-password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
          placeholder="Password"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700" htmlFor="customer-remember">
        <input
          id="customer-remember"
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
          className="h-4 w-4"
        />
        Keep me signed in
      </label>

      {error ? <p className="rounded-xl bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 w-full rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
      >
        {submitting ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
