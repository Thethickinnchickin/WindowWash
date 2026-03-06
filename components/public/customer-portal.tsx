"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SaveCardSetupForm } from "@/components/public/save-card-setup-form";

type PortalData = {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phoneE164: string;
    paymentMethods: {
      id: string;
      brand: string | null;
      last4: string | null;
      expMonth: number | null;
      expYear: number | null;
      isDefault: boolean;
    }[];
  };
  jobs: {
    id: string;
    status: string;
    amountDueCents: number;
    scheduledStart: string;
    scheduledEnd: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    assignedWorker: {
      id: string;
      name: string;
    } | null;
    payments: {
      id: string;
      method: string;
      status: string;
      amountCents: number;
      createdAt: string;
    }[];
  }[];
};

export function CustomerPortal() {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const [startingSetup, setStartingSetup] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/customer/portal", { credentials: "include" });
    const json = await response.json();

    if (!response.ok) {
      setError(json.error?.message || "Failed to load portal");
      setLoading(false);
      return;
    }

    setData(json.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function logout() {
    await fetch("/api/customer/auth/logout", { method: "POST" });
    router.replace("/customer/login");
  }

  async function startSaveCard() {
    setStartingSetup(true);
    setError(null);

    const response = await fetch("/api/customer/setup-intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const json = await response.json();
    setStartingSetup(false);

    if (!response.ok) {
      setError(json.error?.message || "Unable to start card setup");
      return;
    }

    setSetupClientSecret(json.data.clientSecret);
  }

  const upcomingJobs = useMemo(
    () =>
      (data?.jobs || [])
        .filter((job) => new Date(job.scheduledStart).getTime() >= now)
        .sort(
          (left, right) =>
            new Date(left.scheduledStart).getTime() - new Date(right.scheduledStart).getTime(),
        ),
    [data, now],
  );

  const previousJobs = useMemo(
    () =>
      (data?.jobs || [])
        .filter((job) => new Date(job.scheduledStart).getTime() < now)
        .sort(
          (left, right) =>
            new Date(right.scheduledStart).getTime() - new Date(left.scheduledStart).getTime(),
        ),
    [data, now],
  );

  if (loading) {
    return <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Loading portal...</p>;
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error || "Portal unavailable"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Welcome, {data.customer.name}</h2>
            <p className="text-sm text-slate-600">{data.customer.email || data.customer.phoneE164}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Sign Out
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-slate-900">Saved Cards</h3>
          <button
            type="button"
            onClick={() => void startSaveCard()}
            disabled={startingSetup}
            className="min-h-11 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
          >
            {startingSetup ? "Preparing..." : "Add Card"}
          </button>
        </div>

        {data.customer.paymentMethods.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {data.customer.paymentMethods.map((method) => (
              <li key={method.id} className="rounded-xl border border-slate-200 p-3">
                {(method.brand || "card").toUpperCase()} ****{method.last4 || "----"}
                {method.expMonth && method.expYear
                  ? ` exp ${String(method.expMonth).padStart(2, "0")}/${method.expYear}`
                  : ""}
                {method.isDefault ? " (default)" : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No saved cards yet.</p>
        )}

        {setupClientSecret ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <SaveCardSetupForm
              clientSecret={setupClientSecret}
              onSuccess={() => {
                setSetupClientSecret(null);
                void load();
              }}
            />
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">Upcoming Appointments</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {upcomingJobs.map((job) => (
            <li key={job.id} className="rounded-xl border border-slate-200 p-3">
              <p className="font-semibold capitalize text-slate-900">
                {new Date(job.scheduledStart).toLocaleString()} - {job.status.replaceAll("_", " ")}
              </p>
              <p>
                {job.street}, {job.city}, {job.state} {job.zip}
              </p>
              <p>Amount due: ${(job.amountDueCents / 100).toFixed(2)}</p>
              <p>Assigned worker: {job.assignedWorker?.name || "Unassigned"}</p>
              {job.payments[0] ? (
                <p>
                  Latest payment: {job.payments[0].method} {job.payments[0].status} ($
                  {(job.payments[0].amountCents / 100).toFixed(2)})
                </p>
              ) : null}
            </li>
          ))}
          {upcomingJobs.length === 0 ? <li>No upcoming appointments.</li> : null}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">Previous Appointments</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {previousJobs.map((job) => (
            <li key={job.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold capitalize text-slate-900">
                {new Date(job.scheduledStart).toLocaleString()} - {job.status.replaceAll("_", " ")}
              </p>
              <p>
                {job.street}, {job.city}, {job.state} {job.zip}
              </p>
              <p>Amount due: ${(job.amountDueCents / 100).toFixed(2)}</p>
              <p>Assigned worker: {job.assignedWorker?.name || "Unassigned"}</p>
              {job.payments[0] ? (
                <p>
                  Latest payment: {job.payments[0].method} {job.payments[0].status} ($
                  {(job.payments[0].amountCents / 100).toFixed(2)})
                </p>
              ) : null}
            </li>
          ))}
          {previousJobs.length === 0 ? <li>No previous appointments.</li> : null}
        </ul>
      </section>
    </div>
  );
}
