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

type AvailabilitySlot = {
  startIso: string;
  endIso: string;
  label: string;
  availableWorkerCount: number;
};

export function CustomerPortal() {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const [startingSetup, setStartingSetup] = useState(false);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [rescheduleDrafts, setRescheduleDrafts] = useState<Record<string, string>>({});
  const [availabilityByJob, setAvailabilityByJob] = useState<Record<string, AvailabilitySlot[]>>({});
  const [availabilityErrorByJob, setAvailabilityErrorByJob] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const response = await fetch("/api/customer/portal", { credentials: "include" });
    const json = await response.json();

    if (!response.ok) {
      setLoadError(json.error?.message || "Failed to load portal");
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
    setActionError(null);
    setActionNotice(null);

    const response = await fetch("/api/customer/setup-intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const json = await response.json();
    setStartingSetup(false);

    if (!response.ok) {
      setActionError(json.error?.message || "Unable to start card setup");
      return;
    }

    setSetupClientSecret(json.data.clientSecret);
    setActionNotice("Secure card setup is ready below.");
  }

  function toDateTimeLocalValue(date: Date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  function setDraftForJob(jobId: string, value: string) {
    setRescheduleDrafts((current) => ({
      ...current,
      [jobId]: value,
    }));
  }

  async function loadAvailabilityForJob(job: PortalData["jobs"][number]) {
    const draft = rescheduleDrafts[job.id] || toDateTimeLocalValue(new Date(job.scheduledStart));
    const date = draft.slice(0, 10);
    if (!date) {
      return;
    }

    const params = new URLSearchParams();
    params.set("date", date);
    if (job.state) {
      params.set("state", job.state);
    }
    params.set("durationMinutes", "120");

    const response = await fetch(`/api/public/availability?${params.toString()}`, {
      cache: "no-store",
    });
    const json = await response.json();
    if (!response.ok) {
      setAvailabilityErrorByJob((current) => ({
        ...current,
        [job.id]: json.error?.message || "Unable to load availability",
      }));
      setAvailabilityByJob((current) => ({
        ...current,
        [job.id]: [],
      }));
      return;
    }

    setAvailabilityErrorByJob((current) => ({
      ...current,
      [job.id]: "",
    }));
    setAvailabilityByJob((current) => ({
      ...current,
      [job.id]: json.data.slots || [],
    }));
  }

  async function rescheduleJob(job: PortalData["jobs"][number]) {
    const draft = rescheduleDrafts[job.id] || toDateTimeLocalValue(new Date(job.scheduledStart));
    const scheduledStart = new Date(draft);

    if (Number.isNaN(scheduledStart.getTime())) {
      setActionError("Choose a valid reschedule date and time.");
      return;
    }

    setBusyJobId(job.id);
    setActionError(null);
    setActionNotice(null);
    const response = await fetch(`/api/customer/appointments/${job.id}/reschedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scheduledStart: scheduledStart.toISOString(),
        estimatedDurationMinutes: 120,
      }),
    });
    const json = await response.json();
    setBusyJobId(null);

    if (!response.ok) {
      setActionError(json.error?.message || "Unable to reschedule appointment");
      return;
    }

    setActionNotice("Appointment rescheduled.");
    await load();
  }

  async function cancelJob(jobId: string) {
    const confirmed = window.confirm("Cancel this appointment?");
    if (!confirmed) {
      return;
    }

    setBusyJobId(jobId);
    setActionError(null);
    setActionNotice(null);
    const response = await fetch(`/api/customer/appointments/${jobId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: "Canceled by customer",
      }),
    });
    const json = await response.json();
    setBusyJobId(null);

    if (!response.ok) {
      setActionError(json.error?.message || "Unable to cancel appointment");
      return;
    }

    setActionNotice("Appointment canceled.");
    await load();
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

  if (loadError || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {loadError || "Portal unavailable"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {actionError}
        </div>
      ) : null}
      {actionNotice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {actionNotice}
        </div>
      ) : null}
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
              {job.status === "scheduled" || job.status === "on_my_way" ? (
                <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <label className="text-xs font-semibold uppercase text-slate-600">
                    Reschedule Start
                  </label>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      type="datetime-local"
                      className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"
                      value={rescheduleDrafts[job.id] || toDateTimeLocalValue(new Date(job.scheduledStart))}
                      onChange={(event) => setDraftForJob(job.id, event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => void loadAvailabilityForJob(job)}
                      className="min-h-11 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700"
                    >
                      Check Slots
                    </button>
                  </div>
                  {availabilityByJob[job.id]?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {availabilityByJob[job.id].map((slot) => (
                        <button
                          key={slot.startIso}
                          type="button"
                          onClick={() =>
                            setDraftForJob(job.id, toDateTimeLocalValue(new Date(slot.startIso)))
                          }
                          className="min-h-11 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900"
                        >
                          {slot.label} ({slot.availableWorkerCount})
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {availabilityErrorByJob[job.id] ? (
                    <p className="text-xs text-amber-800">{availabilityErrorByJob[job.id]}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void rescheduleJob(job)}
                      disabled={busyJobId === job.id}
                      className="min-h-11 rounded-xl bg-sky-700 px-3 text-xs font-semibold text-white disabled:bg-slate-400"
                    >
                      {busyJobId === job.id ? "Updating..." : "Reschedule"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void cancelJob(job.id)}
                      disabled={busyJobId === job.id}
                      className="min-h-11 rounded-xl border border-rose-300 px-3 text-xs font-semibold text-rose-700 disabled:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
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
