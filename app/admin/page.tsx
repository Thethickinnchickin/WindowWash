import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const [customers, jobs, workers, payments, smsLogs] = await Promise.all([
    prisma.customer.count(),
    prisma.job.count(),
    prisma.user.count({ where: { role: "worker" } }),
    prisma.payment.count({ where: { status: "succeeded" } }),
    prisma.smsLog.count(),
  ]);

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Customers</p>
        <p className="text-2xl font-bold text-slate-900">{customers}</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Jobs</p>
        <p className="text-2xl font-bold text-slate-900">{jobs}</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Workers</p>
        <p className="text-2xl font-bold text-slate-900">{workers}</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Successful Payments</p>
        <p className="text-2xl font-bold text-slate-900">{payments}</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">SMS Logs</p>
        <p className="text-2xl font-bold text-slate-900">{smsLogs}</p>
      </article>
    </section>
  );
}
