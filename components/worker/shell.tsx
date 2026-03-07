"use client";

import { ReactNode } from "react";
import { useOutbox } from "@/hooks/useOutbox";
import { OnlineIndicator } from "@/components/online-indicator";
import { WorkerNavigation } from "@/components/worker/navigation";

export function WorkerShell({ children }: { children: ReactNode }) {
  const outbox = useOutbox();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-6">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-3 py-3 backdrop-blur sm:px-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Window Wash Co</p>
            <h1 className="text-base font-bold text-slate-900 sm:text-lg">Worker App</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {outbox.pendingCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 sm:px-3">
                Pending sync: {outbox.pendingCount}
              </span>
            ) : null}
            <OnlineIndicator />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 md:px-6 md:py-6">{children}</main>
      <WorkerNavigation pendingCount={outbox.pendingCount} />
    </div>
  );
}
