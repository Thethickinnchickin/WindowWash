"use client";

import clsx from "clsx";

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        status === "scheduled" && "bg-slate-200 text-slate-800",
        status === "on_my_way" && "bg-blue-100 text-blue-900",
        status === "in_progress" && "bg-violet-100 text-violet-900",
        status === "finished" && "bg-amber-100 text-amber-900",
        status === "paid" && "bg-emerald-100 text-emerald-900",
        status === "canceled" && "bg-rose-100 text-rose-900",
        status === "needs_attention" && "bg-orange-100 text-orange-900",
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
