"use client";

import { useOutbox } from "@/hooks/useOutbox";

export default function MessagesPage() {
  const outbox = useOutbox();

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-slate-900">Messages and Sync</h2>
      <p className="text-sm text-slate-600">
        Pending actions are stored locally and retried every 15 seconds when online.
      </p>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Outbox Queue ({outbox.pendingCount})</p>
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          {outbox.actions.map((action) => (
            <li key={action.id} className="rounded-xl border border-slate-200 p-2">
              <p className="font-semibold">{action.actionType}</p>
              <p>Job: {action.jobId}</p>
              <p>Queued: {new Date(action.createdAt).toLocaleString()}</p>
            </li>
          ))}
          {outbox.actions.length === 0 ? <li>No pending actions.</li> : null}
        </ul>
      </div>
    </section>
  );
}
