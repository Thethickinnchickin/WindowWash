import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    customers,
    jobs,
    workers,
    payments,
    smsLogs,
    jobsDueToday,
    jobsAtRisk,
    failedPayments,
    failedSms,
    unpaidOpenJobs,
    revenueToday,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.job.count(),
    prisma.user.count({ where: { role: "worker" } }),
    prisma.payment.count({ where: { status: "succeeded" } }),
    prisma.smsLog.count(),
    prisma.job.count({
      where: {
        status: {
          not: "canceled",
        },
        scheduledStart: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    }),
    prisma.job.count({
      where: {
        status: "scheduled",
        customerConfirmedAt: null,
        scheduledStart: {
          gte: now,
          lte: inTwoHours,
        },
      },
    }),
    prisma.payment.count({
      where: {
        status: "failed",
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    }),
    prisma.smsLog.count({
      where: {
        status: "failed",
        createdAt: {
          gte: oneDayAgo,
        },
      },
    }),
    prisma.job.count({
      where: {
        status: {
          in: ["scheduled", "on_my_way", "in_progress", "finished", "needs_attention"],
        },
        scheduledEnd: {
          lt: now,
        },
      },
    }),
    prisma.payment.aggregate({
      _sum: {
        amountCents: true,
      },
      where: {
        status: "succeeded",
        createdAt: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    }),
  ]);

  const revenueTodayCents = revenueToday._sum.amountCents ?? 0;

  return (
    <div className="space-y-4">
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

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Jobs Due Today</p>
          <p className="text-2xl font-bold text-slate-900">{jobsDueToday}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Jobs At Risk (Next 2h, Unconfirmed)</p>
          <p className="text-2xl font-bold text-amber-700">{jobsAtRisk}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Unpaid Open Jobs (Past Due)</p>
          <p className="text-2xl font-bold text-rose-700">{unpaidOpenJobs}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Revenue Today</p>
          <p className="text-2xl font-bold text-emerald-700">
            ${(revenueTodayCents / 100).toFixed(2)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Failed Payments (7d)</p>
          <p className="text-2xl font-bold text-rose-700">{failedPayments}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Failed SMS (24h)</p>
          <p className="text-2xl font-bold text-rose-700">{failedSms}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">Exports</h2>
        <p className="mt-1 text-sm text-slate-600">Download operational data as CSV.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="/api/admin/exports/jobs"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-800"
          >
            Export Jobs CSV
          </a>
          <a
            href="/api/admin/exports/payments"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-800"
          >
            Export Payments CSV
          </a>
          <a
            href="/api/admin/exports/sms"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-800"
          >
            Export SMS CSV
          </a>
        </div>
      </section>
    </div>
  );
}
