"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Profile and Settings</h2>

      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Install on iPad</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Open in Safari.</li>
          <li>Tap Share.</li>
          <li>Tap &quot;Add to Home Screen&quot;.</li>
        </ol>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Session</h3>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={loggingOut}
          className="mt-3 min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
        >
          {loggingOut ? "Signing out..." : "Sign Out"}
        </button>
      </article>
    </section>
  );
}
