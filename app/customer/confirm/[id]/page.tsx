"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function CustomerConfirmPage({
  params,
}: {
  params: { id: string };
}) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  useEffect(() => {
    const tokenValue = searchParams.get("token");
    if (!tokenValue) {
      setError("Missing confirmation token.");
      setLoading(false);
      return;
    }
    const token = tokenValue;

    let cancelled = false;

    async function confirm() {
      try {
        const response = await fetch(
          `/api/public/appointments/${params.id}/confirm?token=${encodeURIComponent(token)}`,
        );
        const json = await response.json();

        if (!response.ok) {
          setError(json.error?.message || "Unable to confirm appointment");
          return;
        }

        if (!cancelled) {
          setConfirmedAt(json.data.confirmedAt || null);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to confirm appointment");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void confirm();

    return () => {
      cancelled = true;
    };
  }, [params.id, searchParams]);

  if (loading) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Confirming Appointment...</h1>
          <p className="mt-2 text-sm text-slate-600">Please wait while we process your confirmation.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {error ? (
          <>
            <h1 className="text-xl font-bold text-rose-700">Could not confirm appointment</h1>
            <p className="mt-2 text-sm text-slate-700">{error}</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-emerald-700">Appointment confirmed</h1>
            <p className="mt-2 text-sm text-slate-700">
              Thanks. Your appointment is confirmed{confirmedAt ? ` on ${new Date(confirmedAt).toLocaleString()}` : ""}.
            </p>
          </>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/book"
            className="inline-flex min-h-11 items-center rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Back to Booking
          </Link>
          <Link
            href="/customer/portal"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
          >
            Customer Portal
          </Link>
        </div>
      </section>
    </main>
  );
}
