"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createIdempotencyKey, sendQueueableAction } from "@/lib/client/outbox";
import { buildMapsLink } from "@/lib/jobs";
import { useOutbox } from "@/hooks/useOutbox";
import { StatusChip } from "@/components/worker/status-chip";
import { CardPaymentForm } from "@/components/worker/card-payment-form";

type JobDetail = {
  id: string;
  status: string;
  amountDueCents: number;
  notes: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
  scheduledStart: string;
  scheduledEnd: string;
  customer: {
    id: string;
    name: string;
    phoneE164: string;
    email: string | null;
    smsOptOut: boolean;
    paymentMethods: {
      id: string;
      brand: string | null;
      last4: string | null;
      expMonth: number | null;
      expYear: number | null;
      isDefault: boolean;
    }[];
  };
  assignedWorker: {
    id: string;
    name: string;
  } | null;
  events: {
    id: string;
    type: string;
    metadata: Record<string, unknown>;
    createdAt: string;
    user: {
      id: string;
      name: string;
      role: string;
    } | null;
  }[];
  payments: {
    id: string;
    status: string;
    method: string;
    paymentType: string;
    amountCents: number;
    cardBrand: string | null;
    cardLast4: string | null;
    createdAt: string;
  }[];
  smsLogs: {
    id: string;
    templateKey: string;
    status: string;
    error: string | null;
    createdAt: string;
  }[];
};

function statusSequence(status: string) {
  if (status === "scheduled") {
    return "on_my_way";
  }

  if (status === "on_my_way") {
    return "in_progress";
  }

  if (status === "in_progress") {
    return "finished";
  }

  return null;
}

export function WorkerJobDetail({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [etaMinutes, setEtaMinutes] = useState("20");
  const [noteText, setNoteText] = useState("");
  const [issueText, setIssueText] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("ON_MY_WAY");
  const [customMessage, setCustomMessage] = useState("");
  const [amountInput, setAmountInput] = useState("0");
  const [paymentType, setPaymentType] = useState<"full" | "partial" | "deposit">("full");
  const [checkNumber, setCheckNumber] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [selectedSavedCardId, setSelectedSavedCardId] = useState("");
  const [cardClientSecret, setCardClientSecret] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const outbox = useOutbox();

  const loadJob = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}`, { credentials: "include" });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error?.message || "Failed to load job");
      }

      setJob(json.data.job);
      const paidCents = json.data.job.payments
        .filter((payment: { status: string }) => payment.status === "succeeded")
        .reduce((sum: number, payment: { amountCents: number }) => sum + payment.amountCents, 0);
      const remaining = Math.max(json.data.job.amountDueCents - paidCents, 0);
      setAmountInput((remaining / 100).toFixed(2));
      setPaymentType("full");
      const defaultSavedCard = json.data.job.customer.paymentMethods.find(
        (method: { isDefault: boolean }) => method.isDefault,
      );
      setSelectedSavedCardId(
        defaultSavedCard?.id || json.data.job.customer.paymentMethods[0]?.id || "",
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load job");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  const nextStatus = useMemo(() => (job ? statusSequence(job.status) : null), [job]);
  const succeededPaidCents = useMemo(
    () =>
      job
        ? job.payments
            .filter((payment) => payment.status === "succeeded")
            .reduce((sum, payment) => sum + payment.amountCents, 0)
        : 0,
    [job],
  );
  const remainingDueCents = useMemo(
    () => (job ? Math.max(job.amountDueCents - succeededPaidCents, 0) : 0),
    [job, succeededPaidCents],
  );
  const canCollectPayment =
    (job?.status === "finished" || job?.status === "paid") && remainingDueCents > 0;

  const hasPendingSync = outbox.pendingByJobId.has(jobId);

  async function handleStatusUpdate(status: string) {
    if (!job) return;
    setSubmitting(true);
    setFeedback(null);

    const payload: Record<string, unknown> = { status };
    if (status === "on_my_way") {
      const eta = Number.parseInt(etaMinutes, 10);
      if (!Number.isFinite(eta) || eta < 1) {
        setSubmitting(false);
        setFeedback("Enter ETA minutes (1 or more).");
        return;
      }
      payload.etaMinutes = eta;
    }

    const result = await sendQueueableAction({
      jobId,
      endpoint: `/api/jobs/${jobId}/status`,
      actionType: "status",
      payload,
    });

    setSubmitting(false);

    if ("error" in result && result.error) {
      setFeedback(result.error);
      return;
    }

    if (result.queued) {
      setFeedback("Status queued. It will sync when connection returns.");
      return;
    }

    setFeedback("Status updated.");
    await loadJob();
  }

  async function handleAddNote(event: FormEvent) {
    event.preventDefault();
    if (!noteText.trim()) return;

    setSubmitting(true);
    setFeedback(null);

    const result = await sendQueueableAction({
      jobId,
      endpoint: `/api/jobs/${jobId}/note`,
      actionType: "note",
      payload: {
        text: noteText.trim(),
      },
    });

    setSubmitting(false);

    if ("error" in result && result.error) {
      setFeedback(result.error);
      return;
    }

    if (result.queued) {
      setFeedback("Note queued for sync.");
      setNoteText("");
      return;
    }

    setFeedback("Note saved.");
    setNoteText("");
    await loadJob();
  }

  async function handleIssue(event: FormEvent) {
    event.preventDefault();
    if (!issueText.trim()) return;

    setSubmitting(true);
    setFeedback(null);

    const response = await fetch(`/api/jobs/${jobId}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: issueText.trim(),
        idempotencyKey: createIdempotencyKey(),
      }),
    });

    const json = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setFeedback(json.error?.message || "Issue report failed");
      return;
    }

    setFeedback("Issue reported.");
    setIssueText("");
    await loadJob();
  }

  async function handleMessage(event: FormEvent) {
    event.preventDefault();

    setSubmitting(true);
    setFeedback(null);

    const response = await fetch(`/api/jobs/${jobId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey: messageTemplate,
        customText: customMessage || undefined,
        idempotencyKey: createIdempotencyKey(),
      }),
    });

    const json = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setFeedback(json.error?.message || "Message failed");
      return;
    }

    setFeedback("Message sent.");
    setCustomMessage("");
    await loadJob();
  }

  async function prepareCardPayment() {
    const amountCents = Math.round(Number.parseFloat(amountInput || "0") * 100);

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setFeedback("Enter a valid amount.");
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const response = await fetch(`/api/jobs/${jobId}/payments/stripe-intent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amountCents,
        paymentType,
        idempotencyKey: createIdempotencyKey(),
      }),
    });

    const json = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setFeedback(json.error?.message || "Unable to create card intent");
      return;
    }

    setCardClientSecret(json.data.clientSecret);
    setFeedback("Card form ready.");
  }

  async function handleCashPayment() {
    const amountCents = Math.round(Number.parseFloat(amountInput || "0") * 100);
    setSubmitting(true);
    setFeedback(null);

    const result = await sendQueueableAction({
      jobId,
      endpoint: `/api/jobs/${jobId}/payments/cash`,
      actionType: "cash_payment",
      payload: {
        amountCents,
        paymentType,
        note: cashNote || undefined,
      },
    });

    setSubmitting(false);

    if ("error" in result && result.error) {
      setFeedback(result.error);
      return;
    }

    if (result.queued) {
      setFeedback("Cash payment queued for sync.");
      return;
    }

    setFeedback("Cash payment recorded.");
    setCashNote("");
    await loadJob();
  }

  async function handleCheckPayment() {
    const amountCents = Math.round(Number.parseFloat(amountInput || "0") * 100);

    setSubmitting(true);
    setFeedback(null);

    const result = await sendQueueableAction({
      jobId,
      endpoint: `/api/jobs/${jobId}/payments/check`,
      actionType: "check_payment",
      payload: {
        amountCents,
        paymentType,
        checkNumber: checkNumber || undefined,
      },
    });

    setSubmitting(false);

    if ("error" in result && result.error) {
      setFeedback(result.error);
      return;
    }

    if (result.queued) {
      setFeedback("Check payment queued for sync.");
      return;
    }

    setFeedback("Check payment recorded.");
    setCheckNumber("");
    await loadJob();
  }

  async function handleSavedCardPayment() {
    const amountCents = Math.round(Number.parseFloat(amountInput || "0") * 100);
    if (!selectedSavedCardId) {
      setFeedback("Select a saved card first.");
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const response = await fetch(`/api/jobs/${jobId}/payments/saved-card`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amountCents,
        paymentType,
        customerPaymentMethodId: selectedSavedCardId,
        idempotencyKey: createIdempotencyKey(),
      }),
    });

    const json = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setFeedback(json.error?.message || "Saved-card charge failed");
      return;
    }

    setFeedback("Saved card charged. Waiting for webhook confirmation.");
    setTimeout(() => {
      void loadJob();
    }, 2000);
  }

  if (loading) {
    return <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Loading job...</p>;
  }

  if (error || !job) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error || "Job unavailable"}
      </div>
    );
  }

  const mapsLink = buildMapsLink({
    street: job.street,
    city: job.city,
    state: job.state,
    zip: job.zip,
  });

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-slate-900">{job.customer.name}</h2>
          <StatusChip status={job.status} />
        </div>
        <p className="mt-1 text-sm text-slate-700">
          {new Date(job.scheduledStart).toLocaleString()} - {new Date(job.scheduledEnd).toLocaleTimeString()}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          {job.street}, {job.city}, {job.state} {job.zip}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`tel:${job.customer.phoneE164}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-800"
          >
            Call Customer
          </a>
          <a
            href={mapsLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-800"
          >
            Open in Maps
          </a>
          {hasPendingSync ? (
            <span className="inline-flex min-h-11 items-center rounded-xl bg-amber-100 px-3 text-xs font-semibold text-amber-900">
              Pending sync on this job
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">
          Amount Due: ${(job.amountDueCents / 100).toFixed(2)}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Amount Paid: ${(succeededPaidCents / 100).toFixed(2)}
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">
          Remaining Balance: ${(remainingDueCents / 100).toFixed(2)}
        </p>
        {job.notes ? <p className="mt-1 text-sm text-slate-700">Notes: {job.notes}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Status Actions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {nextStatus ? (
            <>
              {nextStatus === "on_my_way" ? (
                <input
                  value={etaMinutes}
                  onChange={(event) => setEtaMinutes(event.target.value)}
                  className="min-h-11 w-24 rounded-xl border border-slate-300 px-3 text-sm"
                  type="number"
                  min={1}
                  max={240}
                  placeholder="ETA"
                />
              ) : null}
              <button
                type="button"
                onClick={() => void handleStatusUpdate(nextStatus)}
                disabled={submitting}
                className="min-h-11 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
              >
                {nextStatus === "on_my_way"
                  ? "On My Way"
                  : nextStatus === "in_progress"
                    ? "Start Job"
                    : "Finish Job"}
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-600">No forward status action available.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Payments</h3>
        {job.status !== "finished" && job.status !== "paid" ? (
          <p className="mt-2 text-sm text-amber-800">Finish the job before collecting payment.</p>
        ) : null}
        {remainingDueCents <= 0 ? (
          <p className="mt-2 text-sm text-emerald-800">This job balance is already paid.</p>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            type="number"
            min={0}
            step="0.01"
            placeholder="Amount"
          />
          <select
            className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"
            value={paymentType}
            onChange={(event) =>
              setPaymentType(event.target.value as "full" | "partial" | "deposit")
            }
          >
            <option value="full">Full Payment</option>
            <option value="partial">Partial Payment</option>
            <option value="deposit">Deposit</option>
          </select>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void prepareCardPayment()}
            disabled={submitting || !canCollectPayment}
            className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:bg-slate-100"
          >
            Collect Card
          </button>
        </div>
        {job.customer.paymentMethods.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select
              className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"
              value={selectedSavedCardId}
              onChange={(event) => setSelectedSavedCardId(event.target.value)}
            >
              {job.customer.paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {(method.brand || "card").toUpperCase()} ****{method.last4 || "----"}
                  {method.expMonth && method.expYear
                    ? ` exp ${String(method.expMonth).padStart(2, "0")}/${method.expYear}`
                    : ""}
                  {method.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleSavedCardPayment()}
              disabled={submitting || !canCollectPayment}
              className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:bg-slate-100"
            >
              Charge Saved Card
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            No saved cards on file for this customer.
          </p>
        )}
        {cardClientSecret ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <CardPaymentForm
              clientSecret={cardClientSecret}
              onSuccess={() => {
                setFeedback("Card submitted. Waiting for webhook confirmation.");
                setTimeout(() => {
                  void loadJob();
                }, 2000);
              }}
            />
          </div>
        ) : null}

        <div className="mt-4 grid gap-2">
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"
            value={cashNote}
            onChange={(event) => setCashNote(event.target.value)}
            placeholder="Cash note (optional)"
          />
          <button
            type="button"
            onClick={() => void handleCashPayment()}
            disabled={submitting || !canCollectPayment}
            className="min-h-11 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
          >
            Mark Cash Paid
          </button>
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"
            value={checkNumber}
            onChange={(event) => setCheckNumber(event.target.value)}
            placeholder="Check # (optional)"
          />
          <button
            type="button"
            onClick={() => void handleCheckPayment()}
            disabled={submitting || !canCollectPayment}
            className="min-h-11 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
          >
            Mark Check Paid
          </button>
        </div>

        {job.payments.length > 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 p-3">
            <h4 className="text-sm font-bold text-slate-900">Payment History</h4>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {job.payments.map((payment) => (
                <li key={payment.id}>
                  {new Date(payment.createdAt).toLocaleString()} - {payment.method} -
                  {" $"}
                  {(payment.amountCents / 100).toFixed(2)} - {payment.status}
                  {payment.paymentType ? ` (${payment.paymentType})` : ""}
                  {payment.cardBrand && payment.cardLast4
                    ? ` (${payment.cardBrand.toUpperCase()} ****${payment.cardLast4})`
                    : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Internal Note</h3>
        <form className="mt-3 space-y-2" onSubmit={(event) => void handleAddNote(event)}>
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Add internal note"
          />
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
          >
            Save Note
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Message Customer</h3>
        <form className="mt-3 grid gap-2" onSubmit={(event) => void handleMessage(event)}>
          <select
            className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"
            value={messageTemplate}
            onChange={(event) => setMessageTemplate(event.target.value)}
          >
            <option value="ON_MY_WAY">On My Way</option>
            <option value="STARTED">Started</option>
            <option value="FINISHED">Finished</option>
            <option value="PAID">Paid</option>
            <option value="CUSTOM">Custom</option>
          </select>
          {messageTemplate === "CUSTOM" ? (
            <textarea
              className="min-h-20 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={customMessage}
              onChange={(event) => setCustomMessage(event.target.value)}
              maxLength={320}
              placeholder="Short message"
            />
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:bg-slate-100"
          >
            Send Message
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Report Issue</h3>
        <form className="mt-3 grid gap-2" onSubmit={(event) => void handleIssue(event)}>
          <textarea
            className="min-h-20 rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={issueText}
            onChange={(event) => setIssueText(event.target.value)}
            placeholder="Describe issue"
          />
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
          >
            Report Issue
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Timeline</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {job.events.map((event) => (
            <li key={event.id} className="rounded-xl border border-slate-200 p-2">
              <p className="font-semibold">
                {event.type.replaceAll("_", " ")} - {new Date(event.createdAt).toLocaleString()}
              </p>
              {event.user ? (
                <p className="text-xs text-slate-500">
                  by {event.user.name} ({event.user.role})
                </p>
              ) : null}
              <pre className="mt-1 overflow-x-auto text-xs text-slate-600">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">SMS Logs</h3>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {job.smsLogs.map((sms) => (
            <li key={sms.id}>
              {new Date(sms.createdAt).toLocaleString()} - {sms.templateKey} - {sms.status}
              {sms.error ? ` (${sms.error})` : ""}
            </li>
          ))}
          {!job.smsLogs.length ? <li>No SMS logs yet.</li> : null}
        </ul>
      </section>

      {feedback ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">{feedback}</p>
      ) : null}
    </div>
  );
}
