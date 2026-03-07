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
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur md:static md:mx-auto md:mt-2 md:max-w-6xl md:rounded-2xl md:border md:border-slate-200 md:bg-white md:px-3 md:py-3 md:shadow-sm">
      <div className="scrollbar-none mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto md:overflow-visible">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "relative flex min-h-11 min-w-[96px] flex-1 items-center justify-center rounded-xl px-3 py-2 text-center text-[11px] font-semibold sm:text-xs md:min-w-0",
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
