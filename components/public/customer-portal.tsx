"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PortalData = {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phoneE164: string;
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
  policy: {
    reschedule: {
      cutoffHours: number;
      feeWindowHours: number;
      feeCents: number;
    };
    cancel: {
      cutoffHours: number;
      feeWindowHours: number;
      feeCents: number;
    };
  };
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

    const policy = json.data?.policy;
    if (policy?.feeAppliedCents > 0) {
      setActionNotice(
        `Appointment rescheduled. Policy fee $${(policy.feeAppliedCents / 100).toFixed(2)} applied` +
          `${policy.depositCreditCents > 0 ? `, deposit credit $${(policy.depositCreditCents / 100).toFixed(2)} used` : ""}.`,
      );
    } else {
      setActionNotice("Appointment rescheduled.");
    }
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

    const policy = json.data?.policy;
    if (policy?.feeAppliedCents > 0) {
      setActionNotice(
        `Appointment canceled. Policy fee $${(policy.feeAppliedCents / 100).toFixed(2)} applied` +
          `${policy.depositCreditCents > 0 ? `, deposit credit $${(policy.depositCreditCents / 100).toFixed(2)} used` : ""}.`,
      );
    } else {
      setActionNotice("Appointment canceled.");
    }
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
    <div className="space-y-4 lg:space-y-5">
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
      <div className="grid gap-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Welcome, {data.customer.name}</h2>
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
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Appointments at a glance</h3>
            <p className="mt-1 text-sm text-slate-600">
              Review your upcoming visits, reschedule or cancel when needed, and keep track of each appointment.
            </p>
          </div>
          <a
            href="/book"
            className="neon-button inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-black"
          >
            Book another visit
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-lg font-bold text-slate-900">Upcoming Appointments</h3>
        <p className="mt-1 text-xs text-slate-600">
          Reschedule cutoff: {data.policy.reschedule.cutoffHours}h before start.
          {" "}Fee inside {data.policy.reschedule.feeWindowHours}h: $
          {(data.policy.reschedule.feeCents / 100).toFixed(2)}.
          {" "}Cancel cutoff: {data.policy.cancel.cutoffHours}h.
          {" "}Fee inside {data.policy.cancel.feeWindowHours}h: $
          {(data.policy.cancel.feeCents / 100).toFixed(2)}.
        </p>
        <ul className="mt-3 grid gap-2 text-sm text-slate-700 lg:grid-cols-2">
          {upcomingJobs.map((job) => (
            <li key={job.id} className="h-full rounded-xl border border-slate-200 p-3">
              <p className="font-semibold capitalize text-slate-900">
                {new Date(job.scheduledStart).toLocaleString()} - {job.status.replaceAll("_", " ")}
              </p>
              <p>
                {job.street}, {job.city}, {job.state} {job.zip}
              </p>
              <p>Estimated total: ${(job.amountDueCents / 100).toFixed(2)}</p>
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
                      className="neon-button min-h-11 rounded-xl px-3 text-xs font-black disabled:bg-slate-400 disabled:text-white"
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-lg font-bold text-slate-900">Previous Appointments</h3>
        <ul className="mt-3 grid gap-2 text-sm text-slate-700 lg:grid-cols-2">
          {previousJobs.map((job) => (
            <li key={job.id} className="h-full rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold capitalize text-slate-900">
                {new Date(job.scheduledStart).toLocaleString()} - {job.status.replaceAll("_", " ")}
              </p>
              <p>
                {job.street}, {job.city}, {job.state} {job.zip}
              </p>
              <p>Estimated total: ${(job.amountDueCents / 100).toFixed(2)}</p>
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
