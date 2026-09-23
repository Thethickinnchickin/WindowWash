import type { Metadata } from "next";
import { JobEventType } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audit Log",
};

type AuditSearchParams = Promise<Record<string, string | string[] | undefined>>;

const jobEventTypes = Object.values(JobEventType);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeEventType(value: string | undefined) {
  if (!value) {
    return null;
  }

  return jobEventTypes.includes(value as JobEventType) ? (value as JobEventType) : null;
}

function titleize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function metadataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function formatDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatCents(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return `$${(value / 100).toFixed(2)}`;
}

function actorLabel(event: {
  user: { name: string; email: string; role: string } | null;
  metadata: unknown;
}) {
  if (event.user) {
    return `${event.user.name} (${event.user.role})`;
  }

  const metadata = metadataRecord(event.metadata);
  if (metadata.source === "customer_portal") {
    return "Customer portal";
  }

  if (metadata.source === "public_booking") {
    return "Public booking";
  }

  return "System";
}

function eventSummary(type: JobEventType, metadataValue: unknown) {
  const metadata = metadataRecord(metadataValue);

  if (type === "STATUS_CHANGED") {
    return `Status changed from ${metadata.from ?? "unknown"} to ${metadata.to ?? "unknown"}`;
  }

  if (type === "JOB_RESCHEDULED") {
    const start = formatDate(metadata.scheduledStart);
    return start ? `Rescheduled for ${start}` : "Appointment rescheduled";
  }

  if (type === "JOB_CANCELED") {
    return `Canceled${metadata.reason ? `: ${String(metadata.reason)}` : ""}`;
  }

  if (type === "JOB_ASSIGNED") {
    return metadata.toWorkerId || metadata.workerId
      ? `Assigned worker ${String(metadata.toWorkerId ?? metadata.workerId)}`
      : "Worker assignment changed";
  }

  if (type === "PAYMENT_RECORDED") {
    const amount = formatCents(metadata.amountCents);
    const action = metadata.action ? String(metadata.action) : "recorded";
    return amount ? `Payment ${action}: ${amount}` : `Payment ${action}`;
  }

  if (type === "JOB_UPDATED") {
    const changes = metadataRecord(metadata.changes);
    const fields = Object.keys(changes);
    return fields.length ? `Updated ${fields.join(", ")}` : "Job details updated";
  }

  if (type === "ISSUE_REPORTED") {
    if (metadata.isNoShow === true) {
      return "Marked as no-show";
    }

    if (metadata.isNoShow === false) {
      return "Cleared no-show";
    }

    return "Issue reported";
  }

  return titleize(type);
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: AuditSearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const selectedType = normalizeEventType(firstParam(params.type));

  const events = await prisma.jobEvent.findMany({
    where: selectedType ? { type: selectedType } : undefined,
    orderBy: {
      createdAt: "desc",
    },
    take: 150,
    include: {
      user: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
      job: {
        select: {
          id: true,
          status: true,
          scheduledStart: true,
          street: true,
          city: true,
          state: true,
          zip: true,
          customer: {
            select: {
              name: true,
              email: true,
              phoneE164: true,
            },
          },
          assignedWorker: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold uppercase text-[#8a7211]">Admin audit log</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          Job changes, payments, cancellations, and reschedules
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Review who made operational changes and when they happened. This view shows the newest
          150 job events first.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/audit"
            className={`inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-semibold ${
              selectedType ? "border-slate-300 text-slate-700" : "border-[#D0B830] bg-[#fffaf0] text-slate-950"
            }`}
          >
            All events
          </Link>
          {jobEventTypes.map((type) => (
            <Link
              key={type}
              href={`/admin/audit?type=${type}`}
              className={`inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-semibold ${
                selectedType === type
                  ? "border-[#D0B830] bg-[#fffaf0] text-slate-950"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              {titleize(type)}
            </Link>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Customer / Job</th>
                <th className="px-4 py-3">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {event.createdAt.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                    {titleize(event.type)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <p>{actorLabel(event)}</p>
                    {event.user?.email ? <p className="text-xs text-slate-500">{event.user.email}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <Link href={`/admin/jobs/${event.job.id}`} className="font-semibold text-[#8a7211] underline">
                      {event.job.customer.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {event.job.street}, {event.job.city}, {event.job.state} {event.job.zip}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{eventSummary(event.type, event.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {events.map((event) => (
            <article key={event.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{titleize(event.type)}</p>
                  <p className="text-xs text-slate-500">{event.createdAt.toLocaleString()}</p>
                </div>
                <Link href={`/admin/jobs/${event.job.id}`} className="text-sm font-semibold text-[#8a7211] underline">
                  Open job
                </Link>
              </div>
              <p className="mt-2 text-sm text-slate-700">{eventSummary(event.type, event.metadata)}</p>
              <p className="mt-2 text-sm text-slate-600">
                {event.job.customer.name} - {event.job.city}, {event.job.state}
              </p>
              <p className="mt-1 text-xs text-slate-500">Actor: {actorLabel(event)}</p>
            </article>
          ))}
        </div>

        {!events.length ? (
          <p className="p-4 text-sm text-slate-600">No audit events found for this filter.</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-bold text-slate-900">Raw details</h2>
        <p className="mt-1 text-sm text-slate-600">
          The table above is the quick view. Each job detail page still keeps the full event timeline
          with raw metadata for deeper inspection.
        </p>
      </section>
    </div>
  );
}
