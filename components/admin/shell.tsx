"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/dispatch", label: "Dispatch" },
  { href: "/admin/workers", label: "Workers" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/team/sign-in");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4 md:gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Window Wash Co</p>
            <h1 className="text-base font-bold text-slate-900 sm:text-lg">Admin Dashboard</h1>
          </div>
          <nav className="scrollbar-none order-3 flex w-full gap-2 overflow-x-auto pb-1 md:order-2 md:w-auto md:flex-wrap md:overflow-visible md:pb-0">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 min-w-[104px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="order-2 min-h-11 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400 md:order-3"
          >
            {loggingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 md:px-6 md:py-6">{children}</main>
    </div>
  );
}
