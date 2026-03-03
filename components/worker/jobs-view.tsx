"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { StatusChip } from "@/components/worker/status-chip";
import { useOutbox } from "@/hooks/useOutbox";

type JobRow = {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  amountDueCents: number;
  street: string;
  city: string;
  state: string;
  customer: {
    name: string;
  };
  payments: {
    status: string;
    method: string;
    amountCents: number;
  }[];
};

const ranges = {
  today: {
    label: "Today",
    from: () => startOfDay(new Date()),
    to: () => endOfDay(new Date()),
  },
  tomorrow: {
    label: "Tomorrow",
    from: () => startOfDay(addDays(new Date(), 1)),
    to: () => endOfDay(addDays(new Date(), 1)),
  },
  week: {
    label: "This Week",
    from: () => startOfDay(new Date()),
    to: () => endOfDay(addDays(new Date(), 7)),
  },
} as const;

export function WorkerJobsView({
  title,
  initialRange,
}: {
  title: string;
  initialRange: keyof typeof ranges;
}) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [rangeKey, setRangeKey] = useState<keyof typeof ranges>(initialRange);
  const outbox = useOutbox();

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const range = ranges[rangeKey];
      const params = new URLSearchParams({
        scope: "mine",
        from: range.from().toISOString(),
        to: range.to().toISOString(),
      });

      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      if (query.trim()) {
        params.set("q", query.trim());
      }

      const response = await fetch(`/api/jobs?${params.toString()}`, {
        credentials: "include",
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error?.message || "Failed to load jobs");
      }

      setJobs(json.data.jobs);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [query, rangeKey, statusFilter]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const listContent = useMemo(() => {
    if (loading) {
      return <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Loading jobs...</p>;
    }

    if (error) {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      );
    }

    if (!jobs.length) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No jobs found for these filters.
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        {jobs.map((job) => {
          const latestPayment = job.payments[0];
          const hasPendingSync = outbox.pendingByJobId.has(job.id);

          return (
            <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base font-bold text-slate-900">{job.customer.name}</p>
                <StatusChip status={job.status} />
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {new Date(job.scheduledStart).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {" - "}
                {new Date(job.scheduledEnd).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="mt-1 truncate text-sm text-slate-700">
                {job.street}, {job.city}, {job.state}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-slate-900">
                  Due: ${(job.amountDueCents / 100).toFixed(2)}
                </span>
                <span className="text-slate-600">
                  Payment: {latestPayment ? latestPayment.status : "unpaid"}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                {hasPendingSync ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                    Pending sync
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">Synced</span>
                )}
                <Link
                  href={`/worker/jobs/${job.id}`}
                  className="inline-flex min-h-11 items-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Open Job
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    );
  }, [loading, error, jobs, outbox.pendingByJobId]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <button
          type="button"
          className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          onClick={() => void fetchJobs()}
        >
          Refresh
        </button>
      </div>
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-3">
        <select
          className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
          value={rangeKey}
          onChange={(event) => setRangeKey(event.target.value as keyof typeof ranges)}
        >
          {Object.entries(ranges).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>
        <select
          className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="on_my_way">On my way</option>
          <option value="in_progress">In progress</option>
          <option value="finished">Finished</option>
          <option value="paid">Paid</option>
          <option value="canceled">Canceled</option>
        </select>
        <input
          className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
          placeholder="Search customer or address"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {listContent}
    </section>
  );
}
