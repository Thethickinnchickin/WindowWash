import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerPortal } from "@/components/public/customer-portal";
import { getCustomerSessionAccount } from "@/lib/customer-auth";

export default async function CustomerPortalPage() {
  const account = await getCustomerSessionAccount();

  if (!account) {
    redirect("/customer/login");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-cyan-100 via-white to-sky-100 p-4">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Window Wash Co</p>
          <h1 className="text-3xl font-bold text-slate-900">Customer Portal</h1>
          <p className="mt-1 text-sm text-slate-700">
            Manage your appointments and saved payment methods.
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Need a new appointment? {" "}
            <Link href="/book" className="font-semibold text-sky-700 underline">
              Book service
            </Link>
          </p>
        </header>
        <CustomerPortal />
      </div>
    </main>
  );
}
