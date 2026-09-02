"use client";

import { ReactNode } from "react";
import { useOutbox } from "@/hooks/useOutbox";
import { OnlineIndicator } from "@/components/online-indicator";
import { WorkerNavigation } from "@/components/worker/navigation";
import { NeonLogo } from "@/components/brand/neon-logo";

export function WorkerShell({ children }: { children: ReactNode }) {
  const outbox = useOutbox();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4fbff_0%,#f7f2ff_52%,#ffffff_100%)] pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-6">
      <header className="sticky top-0 z-20 border-b border-cyan-100 bg-white/95 px-3 py-3 backdrop-blur sm:px-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 sm:gap-3">
          <NeonLogo tagline="Worker App" />
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
