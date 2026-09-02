"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NeonLogo } from "@/components/brand/neon-logo";

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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4fbff_0%,#f7f2ff_52%,#ffffff_100%)]">
      <header className="sticky top-0 z-20 border-b border-cyan-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4 md:gap-4">
          <NeonLogo tagline="Admin Dashboard" />
          <nav className="scrollbar-none order-3 flex w-full gap-2 overflow-x-auto pb-1 md:order-2 md:w-auto md:flex-wrap md:overflow-visible md:pb-0">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 min-w-[104px] items-center justify-center rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:border-fuchsia-300"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="neon-button order-2 min-h-11 rounded-xl px-3 py-2 text-sm font-black disabled:bg-slate-400 disabled:text-white md:order-3"
          >
            {loggingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 md:px-6 md:py-6">{children}</main>
    </div>
  );
}
