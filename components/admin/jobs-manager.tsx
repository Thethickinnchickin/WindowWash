"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Customer = {
  id: string;
  name: string;
};

type Worker = {
  id: string;
  name: string;
};

type Job = {
  id: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  amountDueCents: number;
  street: string;
  city: string;
  customer: {
    id: string;
    name: string;
  };
  assignedWorker: {
    id: string;
    name: string;
  } | null;
};

export function JobsManager() {
  const DEFAULT_APPOINTMENT_DURATION_MINUTES = 120;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [assignedWorkerId, setAssignedWorkerId] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [amountDue, setAmountDue] = useState("0");
  const [notes, setNotes] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  async function loadLookups() {
    const [customersResponse, workersResponse] = await Promise.all([
      fetch("/api/admin/customers"),
      fetch("/api/admin/workers"),
    ]);

    const customersJson = await customersResponse.json();
    const workersJson = await workersResponse.json();

    if (customersResponse.ok) {
      setCustomers(customersJson.data.customers);
      if (!customerId && customersJson.data.customers.length > 0) {
        setCustomerId(customersJson.data.customers[0].id);
      }
    }

    if (workersResponse.ok) {
      setWorkers(workersJson.data.workers);
      if (!assignedWorkerId && workersJson.data.workers.length > 0) {
        setAssignedWorkerId(workersJson.data.workers[0].id);
      }
    }
  }

  async function loadJobs() {
    const response = await fetch("/api/admin/jobs");
    const json = await response.json();
    if (!response.ok) {
      setError(json.error?.message || "Failed to load jobs");
      return;
    }

    setJobs(json.data.jobs);
    setError(null);
  }

  async function loadAll() {
    await Promise.all([loadLookups(), loadJobs()]);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function createJob(event: FormEvent) {
    event.preventDefault();

    const response = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        assignedWorkerId: assignedWorkerId || null,
        scheduledStart: new Date(scheduledStart).toISOString(),
        estimatedDurationMinutes: DEFAULT_APPOINTMENT_DURATION_MINUTES,
        amountDueCents: Math.round(Number.parseFloat(amountDue || "0") * 100),
        notes,
        street,
        city,
        state,
        zip,
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error?.message || "Failed to create job");
      return;
    }

    setNotes("");
    await loadJobs();
  }

  async function assignJob(jobId: string, workerId: string) {
    const response = await fetch(`/api/admin/jobs/${jobId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId }),
    });

    const json = await response.json();
    if (!response.ok) {
      setError(json.error?.message || "Assign failed");
      return;
    }

    await loadJobs();
  }

  async function cancelJob(jobId: string) {
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

    await loadJobs();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">Create Job</h2>
        <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={(event) => void createJob(event)}>
          <select
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            required
          >
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <select
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            value={assignedWorkerId}
            onChange={(event) => setAssignedWorkerId(event.target.value)}
          >
            <option value="">Unassigned</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            value={scheduledStart}
            onChange={(event) => setScheduledStart(event.target.value)}
            required
          />
          <p className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            Service window auto-set to 2 hours after start time.
          </p>
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            value={amountDue}
            onChange={(event) => setAmountDue(event.target.value)}
            type="number"
            min={0}
            step="0.01"
            placeholder="Amount due"
            required
          />
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            placeholder="Street"
            required
          />
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="City"
            required
          />
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            value={state}
            onChange={(event) => setState(event.target.value)}
            placeholder="State"
            required
          />
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            value={zip}
            onChange={(event) => setZip(event.target.value)}
            placeholder="ZIP"
            required
          />
          <input
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes"
          />
          <button className="min-h-11 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white" type="submit">
            Save Job
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">Jobs</h2>
        {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
        <div className="mt-3 space-y-2">
          {jobs.map((job) => (
            <article key={job.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{job.customer.name}</p>
                <p className="text-sm capitalize text-slate-700">{job.status.replaceAll("_", " ")}</p>
              </div>
              <p className="text-sm text-slate-600">
                {new Date(job.scheduledStart).toLocaleString()} - {new Date(job.scheduledEnd).toLocaleTimeString()}
              </p>
              <p className="text-sm text-slate-600">
                {job.street}, {job.city}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"
                  defaultValue={job.assignedWorker?.id || ""}
                  onChange={(event) => void assignJob(job.id, event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {workers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void cancelJob(job.id)}
                  className="min-h-11 rounded-xl border border-rose-300 px-3 text-sm font-semibold text-rose-700"
                >
                  Cancel
                </button>
                <Link
                  href={`/admin/jobs/${job.id}`}
                  className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  Open Details
                </Link>
              </div>
            </article>
          ))}
          {!jobs.length ? <p className="text-sm text-slate-600">No jobs yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
