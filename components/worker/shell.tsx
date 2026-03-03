"use client";

import { ReactNode } from "react";
import { useOutbox } from "@/hooks/useOutbox";
import { OnlineIndicator } from "@/components/online-indicator";
import { WorkerNavigation } from "@/components/worker/navigation";

export function WorkerShell({ children }: { children: ReactNode }) {
  const outbox = useOutbox();

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Window Wash Co</p>
            <h1 className="text-lg font-bold text-slate-900">Worker App</h1>
          </div>
          <div className="flex items-center gap-2">
            {outbox.pendingCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                Pending sync: {outbox.pendingCount}
              </span>
            ) : null}
            <OnlineIndicator />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4">{children}</main>
      <WorkerNavigation pendingCount={outbox.pendingCount} />
    </div>
  );
}
