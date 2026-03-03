"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const items = [
  { href: "/worker/today", label: "Today" },
  { href: "/worker/upcoming", label: "Upcoming" },
  { href: "/worker/search", label: "Job Search" },
  { href: "/worker/messages", label: "Messages" },
  { href: "/worker/settings", label: "Settings" },
];

export function WorkerNavigation({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "relative flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-xl px-2 py-2 text-center text-xs font-semibold",
                active
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              {item.label}
              {item.href === "/worker/messages" && pendingCount > 0 ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
