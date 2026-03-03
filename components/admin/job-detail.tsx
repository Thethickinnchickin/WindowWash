"use client";

import { FormEvent, useEffect, useState } from "react";

export function AdminJobDetail({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [amountDue, setAmountDue] = useState("0");
  const [notes, setNotes] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");

  async function load() {
    const response = await fetch(`/api/admin/jobs/${jobId}`);
    const json = await response.json();

    if (!response.ok) {
      setError(json.error?.message || "Failed to load job");
      return;
    }

    const loaded = json.data.job;
    setJob(loaded);
    setStatus(loaded.status);
    setAmountDue((loaded.amountDueCents / 100).toFixed(2));
    setNotes(loaded.notes || "");
    setScheduledStart(new Date(loaded.scheduledStart).toISOString().slice(0, 16));
    setScheduledEnd(new Date(loaded.scheduledEnd).toISOString().slice(0, 16));
    setError(null);
  }

  useEffect(() => {
    void load();
  }, [jobId]);

  async function savePatch(event: FormEvent) {
    event.preventDefault();

    const response = await fetch(`/api/admin/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        amountDueCents: Math.round(Number.parseFloat(amountDue || "0") * 100),
        notes,
        scheduledStart: new Date(scheduledStart).toISOString(),
        scheduledEnd: new Date(scheduledEnd).toISOString(),
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error?.message || "Update failed");
      return;
    }

    await load();
  }

  async function reschedule() {
    const response = await fetch(`/api/admin/jobs/${jobId}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledStart: new Date(scheduledStart).toISOString(),
        scheduledEnd: new Date(scheduledEnd).toISOString(),
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error?.message || "Reschedule failed");
      return;
    }

    await load();
  }

  async function cancel() {
    const response = await fetch(`/api/admin/jobs/${jobId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Canceled by admin" }),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error?.message || "Cancel failed");
      return;
    }

    await load();
  }

  if (error && !job) {
    return <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>;
  }

  if (!job) {
    return <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Loading job...</p>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">{job.customer.name}</h2>
        <p className="text-sm text-slate-600">
          {job.street}, {job.city}, {job.state} {job.zip}
        </p>
        <p className="text-sm text-slate-600">Assigned: {job.assignedWorker?.name || "Unassigned"}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Edit Job</h3>
        <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={(event) => void savePatch(event)}>
          <select
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="scheduled">Scheduled</option>
            <option value="on_my_way">On my way</option>
            <option value="in_progress">In progress</option>
            <option value="finished">Finished</option>
            <option value="paid">Paid</option>
            <option value="needs_attention">Needs attention</option>
            <option value="canceled">Canceled</option>
          </select>
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            value={amountDue}
            onChange={(event) => setAmountDue(event.target.value)}
            type="number"
            min={0}
            step="0.01"
          />
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            type="datetime-local"
            value={scheduledStart}
            onChange={(event) => setScheduledStart(event.target.value)}
          />
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            type="datetime-local"
            value={scheduledEnd}
            onChange={(event) => setScheduledEnd(event.target.value)}
          />
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3 sm:col-span-2"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes"
          />
          <button className="min-h-11 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white" type="submit">
            Save Updates
          </button>
          <button
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"
            type="button"
            onClick={() => void reschedule()}
          >
            Reschedule
          </button>
          <button
            className="min-h-11 rounded-xl border border-rose-300 px-4 text-sm font-semibold text-rose-700"
            type="button"
            onClick={() => void cancel()}
          >
            Cancel Job
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Timeline</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {job.events.map((event: any) => (
            <li key={event.id} className="rounded-xl border border-slate-200 p-2">
              <p className="font-semibold">{event.type.replaceAll("_", " ")}</p>
              <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
              <pre className="mt-1 overflow-x-auto text-xs text-slate-600">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Payments</h3>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          {job.payments.map((payment: any) => (
            <li key={payment.id}>
              {new Date(payment.createdAt).toLocaleString()} - {payment.method} -
              {" $"}
              {(payment.amountCents / 100).toFixed(2)} - {payment.status}
            </li>
          ))}
          {!job.payments.length ? <li>No payments yet.</li> : null}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">SMS Logs</h3>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          {job.smsLogs.map((sms: any) => (
            <li key={sms.id}>
              {new Date(sms.createdAt).toLocaleString()} - {sms.templateKey} - {sms.status}
              {sms.error ? ` (${sms.error})` : ""}
            </li>
          ))}
          {!job.smsLogs.length ? <li>No SMS logs yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
