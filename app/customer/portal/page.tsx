import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerPortal } from "@/components/public/customer-portal";
import { getCustomerSessionAccount } from "@/lib/customer-auth";
import { NeonLogo } from "@/components/brand/neon-logo";

export default async function CustomerPortalPage() {
  const account = await getCustomerSessionAccount();

  if (!account) {
    redirect("/customer/login");
  }

  return (
    <main className="neon-page-bg min-h-screen p-4">
      <div className="mx-auto max-w-6xl">
        <header className="neon-panel mb-4 rounded-2xl p-4">
          <NeonLogo tagline="Customer Portal" />
          <h1 className="text-3xl font-bold text-slate-900">Customer Portal</h1>
          <p className="mt-1 text-sm text-slate-700">
            Manage your appointments and saved payment methods.
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Need a new appointment? {" "}
            <Link href="/book" className="font-semibold text-fuchsia-700 underline">
              Book service
            </Link>
          </p>
        </header>
        <CustomerPortal />
      </div>
    </main>
  );
}
