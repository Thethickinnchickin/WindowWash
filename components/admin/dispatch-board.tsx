"use client";

import Link from "next/link";
import { type DragEvent, useEffect, useMemo, useState } from "react";

type DispatchJob = {
  id: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  amountDueCents: number;
  street: string;
  city: string;
  state: string;
  zip: string;
  isNoShow: boolean;
  assignedWorkerId: string | null;
  customer: {
    id: string;
    name: string;
  };
};

type WorkerColumn = {
  worker: {
    id: string;
    name: string;
  };
  jobs: DispatchJob[];
  conflictJobIds: string[];
};

type DispatchPayload = {
  date: string;
  workers: WorkerColumn[];
  unassignedJobs: DispatchJob[];
};

type AssignmentTarget = {
  workerId: string | null;
  label: string;
};

function todayIsoDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatWindow(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export function DispatchBoard() {
  const [selectedDate, setSelectedDate] = useState(todayIsoDate);
  const [data, setData] = useState<DispatchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [dragJobId, setDragJobId] = useState<string | null>(null);

  async function load(date: string) {
    setLoading(true);
    const response = await fetch(`/api/admin/dispatch?date=${encodeURIComponent(date)}`, {
      cache: "no-store",
    });
    const json = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(json.error?.message || "Unable to load dispatch board");
      return;
    }

    setData(json.data);
    setError(null);
  }

  useEffect(() => {
    void load(selectedDate);
  }, [selectedDate]);

  const assignmentTargets = useMemo<AssignmentTarget[]>(() => {
    if (!data) {
      return [];
    }

    return [
      {
        workerId: null,
        label: "Unassigned",
      },
      ...data.workers.map((column) => ({
        workerId: column.worker.id,
        label: column.worker.name,
      })),
    ];
  }, [data]);

  function findCurrentWorkerId(jobId: string) {
    if (!data) {
      return null;
    }

    for (const column of data.workers) {
      if (column.jobs.some((job) => job.id === jobId)) {
        return column.worker.id;
      }
    }

    if (data.unassignedJobs.some((job) => job.id === jobId)) {
      return null;
    }

    return null;
  }

  async function reassignJob(jobId: string, workerId: string | null) {
    const currentWorkerId = findCurrentWorkerId(jobId);
    if (currentWorkerId === workerId) {
      return;
    }

    setActiveJobId(jobId);
    setNotice(null);
    const response = await fetch("/api/admin/dispatch/reassign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId,
        workerId,
      }),
    });
    const json = await response.json();
    setActiveJobId(null);

    if (!response.ok) {
      setError(json.error?.message || "Unable to reassign job");
      return;
    }

    setError(null);
    setNotice("Assignment updated.");
    await load(selectedDate);
  }

  async function toggleNoShow(job: DispatchJob) {
    const markAsNoShow = !job.isNoShow;
    let reason: string | undefined = undefined;

    if (markAsNoShow) {
      const input = window.prompt("No-show reason (optional)", "Customer not available");
      if (input === null) {
        return;
      }
      reason = input.trim() || undefined;
    }

    setActiveJobId(job.id);
    setNotice(null);
    const response = await fetch(`/api/admin/jobs/${job.id}/no-show`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        isNoShow: markAsNoShow,
        reason,
      }),
    });
    const json = await response.json();
    setActiveJobId(null);

    if (!response.ok) {
      setError(json.error?.message || "Unable to update no-show");
      return;
    }

    setError(null);
    setNotice(markAsNoShow ? "Job marked as no-show." : "No-show cleared.");
    await load(selectedDate);
  }

  function onDrop(targetWorkerId: string | null) {
    if (!dragJobId) {
      return;
    }

    void reassignJob(dragJobId, targetWorkerId);
    setDragJobId(null);
  }

  if (loading && !data) {
    return <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Loading dispatch board...</p>;
  }

  if (error && !data) {
    return <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Dispatch Board</h2>
            <p className="text-sm text-slate-600">
              Drag jobs between columns, review conflicts, and mark no-shows.
            </p>
          </div>
          <label className="text-sm font-semibold text-slate-700">
            Date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="ml-2 min-h-11 rounded-xl border border-slate-300 px-3 text-sm"
            />
          </label>
        </div>
        {notice ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-800">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </section>

      <section className="overflow-x-auto pb-2">
        <div className="grid min-w-[980px] gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DispatchColumn
            title="Unassigned"
            subtitle={`${data?.unassignedJobs.length || 0} job(s)`}
            jobs={data?.unassignedJobs || []}
            conflictJobIds={[]}
            targets={assignmentTargets}
            activeJobId={activeJobId}
            onAssign={reassignJob}
            onToggleNoShow={toggleNoShow}
            onDragStart={setDragJobId}
            onDragEnd={() => setDragJobId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDrop(null)}
          />

          {(data?.workers || []).map((column) => (
            <DispatchColumn
              key={column.worker.id}
              title={column.worker.name}
              subtitle={`${column.jobs.length} job(s)`}
              jobs={column.jobs}
              conflictJobIds={column.conflictJobIds}
              targets={assignmentTargets}
              activeJobId={activeJobId}
              onAssign={reassignJob}
              onToggleNoShow={toggleNoShow}
              onDragStart={setDragJobId}
              onDragEnd={() => setDragJobId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onDrop(column.worker.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function DispatchColumn(props: {
  title: string;
  subtitle: string;
  jobs: DispatchJob[];
  conflictJobIds: string[];
  targets: AssignmentTarget[];
  activeJobId: string | null;
  onAssign: (jobId: string, workerId: string | null) => Promise<void>;
  onToggleNoShow: (job: DispatchJob) => Promise<void>;
  onDragStart: (jobId: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const conflictSet = new Set(props.conflictJobIds);
  const hasConflicts = props.conflictJobIds.length > 0;

  return (
    <article
      className="rounded-2xl border border-slate-200 bg-white p-3"
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
    >
      <h3 className="text-base font-bold text-slate-900">{props.title}</h3>
      <p className="text-xs text-slate-500">{props.subtitle}</p>
      {hasConflicts ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          Conflict detected: overlapping schedule in this column.
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        {props.jobs.map((job) => {
          const isBusy = props.activeJobId === job.id;
          const hasConflict = conflictSet.has(job.id);
          return (
            <div
              key={job.id}
              draggable
              onDragStart={() => props.onDragStart(job.id)}
              onDragEnd={props.onDragEnd}
              className={`rounded-xl border p-3 ${hasConflict ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{job.customer.name}</p>
                  <p className="text-xs text-slate-600">{formatWindow(job.scheduledStart, job.scheduledEnd)}</p>
                  <p className="text-xs text-slate-600">
                    {job.street}, {job.city}
                  </p>
                  <p className="text-xs text-slate-600">
                    ${Number(job.amountDueCents / 100).toFixed(2)} - {job.status.replaceAll("_", " ")}
                  </p>
                  {job.isNoShow ? (
                    <p className="mt-1 inline-block rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                      No-show
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/admin/jobs/${job.id}`}
                  className="min-h-11 rounded-xl border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700"
                >
                  Open
                </Link>
              </div>
              <div className="mt-2 grid gap-2">
                <label className="text-xs font-semibold text-slate-600">
                  Assign
                  <select
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-2 text-sm"
                    value={job.assignedWorkerId || ""}
                    disabled={isBusy}
                    onChange={(event) =>
                      void props.onAssign(job.id, event.target.value ? event.target.value : null)
                    }
                  >
                    {props.targets.map((target) => (
                      <option
                        key={target.workerId || "unassigned"}
                        value={target.workerId || ""}
                      >
                        {target.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void props.onToggleNoShow(job)}
                  disabled={isBusy}
                  className={`min-h-11 rounded-xl border px-3 text-xs font-semibold disabled:bg-slate-100 ${job.isNoShow ? "border-emerald-300 text-emerald-700" : "border-rose-300 text-rose-700"}`}
                >
                  {isBusy ? "Saving..." : job.isNoShow ? "Clear No-Show" : "Mark No-Show"}
                </button>
              </div>
            </div>
          );
        })}
        {props.jobs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-3 text-xs text-slate-500">
            No jobs.
          </p>
        ) : null}
      </div>
    </article>
  );
}
