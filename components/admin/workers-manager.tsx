"use client";

import { FormEvent, useEffect, useState } from "react";

type Worker = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  serviceState: string | null;
  dailyJobCapacity: number;
  createdAt: string;
};

export function WorkersManager() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("TempPass123!");
  const [serviceState, setServiceState] = useState("CA");
  const [dailyJobCapacity, setDailyJobCapacity] = useState("8");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/admin/workers");
    const json = await response.json();

    if (!response.ok) {
      setError(json.error?.message || "Failed to load workers");
      return;
    }

    setWorkers(json.data.workers);
    setError(null);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createWorker(event: FormEvent) {
    event.preventDefault();
    const parsedCapacity = Number.parseInt(dailyJobCapacity, 10);
    if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 50) {
      setError("Daily job capacity must be between 1 and 50.");
      return;
    }

    const response = await fetch("/api/admin/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        tempPassword,
        serviceState: serviceState.trim() || undefined,
        dailyJobCapacity: parsedCapacity,
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error?.message || "Failed to create worker");
      return;
    }

    setName("");
    setEmail("");
    setTempPassword("TempPass123!");
    setServiceState("CA");
    setDailyJobCapacity("8");
    await load();
  }

  async function resetPassword(workerId: string) {
    const nextPassword = resetPasswords[workerId] || "TempPass123!";

    const response = await fetch(`/api/admin/workers/${workerId}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempPassword: nextPassword }),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error?.message || "Reset failed");
      return;
    }

    setError(null);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">Create Worker</h2>
        <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={(event) => void createWorker(event)}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            placeholder="Full name"
            required
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            placeholder="Email"
            required
            type="email"
          />
          <input
            value={tempPassword}
            onChange={(event) => setTempPassword(event.target.value)}
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            placeholder="Temp password"
            required
          />
          <input
            value={serviceState}
            onChange={(event) => setServiceState(event.target.value)}
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            placeholder="Service state (e.g. CA)"
          />
          <input
            value={dailyJobCapacity}
            onChange={(event) => setDailyJobCapacity(event.target.value)}
            className="min-h-11 rounded-xl border border-slate-300 px-3"
            placeholder="Daily job capacity"
            type="number"
            min={1}
            max={50}
            required
          />
          <button className="min-h-11 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white" type="submit">
            Create Worker
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">Workers</h2>
        {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
        <div className="mt-3 space-y-2">
          {workers.map((worker) => (
            <article key={worker.id} className="rounded-xl border border-slate-200 p-3">
              <p className="font-semibold text-slate-900">{worker.name}</p>
              <p className="text-sm text-slate-600">{worker.email}</p>
              <p className="text-xs text-slate-500">
                Region: {worker.serviceState || "Any"} | Daily capacity: {worker.dailyJobCapacity}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"
                  placeholder="Reset temp password"
                  value={resetPasswords[worker.id] || ""}
                  onChange={(event) =>
                    setResetPasswords((prev) => ({
                      ...prev,
                      [worker.id]: event.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() => void resetPassword(worker.id)}
                  className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-800"
                >
                  Reset Password
                </button>
              </div>
            </article>
          ))}
          {!workers.length ? <p className="text-sm text-slate-600">No workers yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
