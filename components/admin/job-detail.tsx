"use client";

import { FormEvent, useEffect, useState } from "react";

export function AdminJobDetail({ jobId }: { jobId: string }) {
  const DEFAULT_APPOINTMENT_DURATION_MINUTES = 120;
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentActionId, setPaymentActionId] = useState<string | null>(null);
  const [invoiceActionId, setInvoiceActionId] = useState<string | null>(null);
  const [invoiceNotice, setInvoiceNotice] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [amountDue, setAmountDue] = useState("0");
  const [notes, setNotes] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");

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
        estimatedDurationMinutes: DEFAULT_APPOINTMENT_DURATION_MINUTES,
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error?.message || "Update failed");
      return;
    }

    setError(null);
    await load();
  }

  async function reschedule() {
    const response = await fetch(`/api/admin/jobs/${jobId}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledStart: new Date(scheduledStart).toISOString(),
        estimatedDurationMinutes: DEFAULT_APPOINTMENT_DURATION_MINUTES,
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error?.message || "Reschedule failed");
      return;
    }

    setError(null);
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

    setError(null);
    await load();
  }

  async function toggleNoShow() {
    const markAsNoShow = !Boolean(job?.isNoShow);
    let reason: string | undefined = undefined;

    if (markAsNoShow) {
      const input = window.prompt("No-show reason (optional)", "Customer not available");
      if (input === null) {
        return;
      }
      reason = input.trim() || undefined;
    }

    const response = await fetch(`/api/admin/jobs/${jobId}/no-show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isNoShow: markAsNoShow,
        reason,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      setError(json.error?.message || "Unable to update no-show");
      return;
    }

    setError(null);
    setInvoiceNotice(markAsNoShow ? "Marked as no-show." : "No-show cleared.");
    await load();
  }

  async function sendInvoiceEmail(paymentId?: string) {
    const actionId = paymentId || "all";
    setInvoiceActionId(actionId);
    setInvoiceNotice(null);

    const response = await fetch(`/api/admin/jobs/${jobId}/invoice-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentId ? { paymentId } : {}),
    });
    const json = await response.json();
    setInvoiceActionId(null);

    if (!response.ok) {
      setError(json.error?.message || "Unable to send invoice email");
      return;
    }

    setError(null);
    setInvoiceNotice(
      json.data?.status === "mock_sent"
        ? `Mock invoice email logged for ${json.data.emailTo}.`
        : `Invoice email sent to ${json.data.emailTo}.`,
    );
  }

  async function refundPayment(payment: any) {
    const refundableCents = Math.max(
      Number(payment.amountCents || 0) - Number(payment.refundedAmountCents || 0),
      0,
    );

    if (refundableCents <= 0) {
      setError("This payment is already fully refunded.");
      return;
    }

    const suggested = (refundableCents / 100).toFixed(2);
    const input = window.prompt(
      `Refund amount (max $${suggested})`,
      suggested,
    );

    if (input === null) {
      return;
    }

    const amountCents = Math.round(Number.parseFloat(input || "0") * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0 || amountCents > refundableCents) {
      setError("Invalid refund amount.");
      return;
    }

    setPaymentActionId(payment.id);
    const response = await fetch(`/api/admin/payments/${payment.id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents,
        reason: "Refunded by admin",
      }),
    });
    const json = await response.json();
    setPaymentActionId(null);

    if (!response.ok) {
      setError(json.error?.message || "Refund failed");
      return;
    }

    await load();
  }

  async function voidPayment(payment: any) {
    setPaymentActionId(payment.id);
    const response = await fetch(`/api/admin/payments/${payment.id}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "Voided by admin",
      }),
    });
    const json = await response.json();
    setPaymentActionId(null);

    if (!response.ok) {
      setError(json.error?.message || "Void failed");
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
        {job.isNoShow ? (
          <p className="mt-2 inline-block rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">
            No-show
          </p>
        ) : null}
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
          <p className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            Service window auto-set to 2 hours after start time.
          </p>
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
          <button
            className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${job.isNoShow ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-800"}`}
            type="button"
            onClick={() => void toggleNoShow()}
          >
            {job.isNoShow ? "Clear No-Show" : "Mark No-Show"}
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
        {invoiceNotice ? <p className="mt-2 text-sm text-emerald-700">{invoiceNotice}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Invoice and Receipt Email</h3>
        <p className="mt-1 text-sm text-slate-600">
          Send a PDF invoice/receipt to {job.customer.email || "the customer email on file"}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void sendInvoiceEmail()}
            disabled={invoiceActionId === "all"}
            className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:bg-slate-100"
          >
            {invoiceActionId === "all" ? "Sending..." : "Send Invoice (All Payments)"}
          </button>
        </div>
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
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {job.payments.map((payment: any) => (
            <li key={payment.id} className="rounded-xl border border-slate-200 p-2">
              <p>
                {new Date(payment.createdAt).toLocaleString()} - {payment.method} -
                {" $"}
                {(payment.amountCents / 100).toFixed(2)} - {payment.status}
                {payment.paymentType ? ` (${payment.paymentType})` : ""}
              </p>
              {Number(payment.refundedAmountCents || 0) > 0 ? (
                <p className="text-xs text-slate-600">
                  Refunded: ${(Number(payment.refundedAmountCents || 0) / 100).toFixed(2)}
                </p>
              ) : null}
              {payment.refunds?.length ? (
                <ul className="mt-1 space-y-1 text-xs text-slate-600">
                  {payment.refunds.map((refund: any) => (
                    <li key={refund.id}>
                      Refund {new Date(refund.createdAt).toLocaleString()} -
                      {" $"}
                      {(refund.amountCents / 100).toFixed(2)} - {refund.status}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {(payment.status === "succeeded" || payment.status === "refunded") &&
                Number(payment.amountCents || 0) > Number(payment.refundedAmountCents || 0) ? (
                  <button
                    type="button"
                    onClick={() => void refundPayment(payment)}
                    disabled={paymentActionId === payment.id}
                    className="min-h-11 rounded-xl border border-amber-300 px-3 text-xs font-semibold text-amber-800 disabled:bg-slate-100"
                  >
                    {paymentActionId === payment.id ? "Processing..." : "Refund"}
                  </button>
                ) : null}
                {payment.status === "pending" && payment.method === "card" ? (
                  <button
                    type="button"
                    onClick={() => void voidPayment(payment)}
                    disabled={paymentActionId === payment.id}
                    className="min-h-11 rounded-xl border border-rose-300 px-3 text-xs font-semibold text-rose-700 disabled:bg-slate-100"
                  >
                    {paymentActionId === payment.id ? "Processing..." : "Void"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void sendInvoiceEmail(payment.id)}
                  disabled={invoiceActionId === payment.id}
                  className="min-h-11 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:bg-slate-100"
                >
                  {invoiceActionId === payment.id ? "Sending..." : "Email Receipt"}
                </button>
              </div>
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
