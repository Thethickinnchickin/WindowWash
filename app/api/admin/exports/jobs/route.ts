import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);

    const from = parseDate(request.nextUrl.searchParams.get("from"));
    const to = parseDate(request.nextUrl.searchParams.get("to"));

    const jobs = await prisma.job.findMany({
      where: {
        ...(from || to
          ? {
              scheduledStart: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
        assignedWorker: {
          select: {
            name: true,
          },
        },
        payments: {
          select: {
            status: true,
            amountCents: true,
          },
        },
      },
      orderBy: {
        scheduledStart: "desc",
      },
      take: 5000,
    });

    const headers = [
      "jobId",
      "status",
      "scheduledStart",
      "scheduledEnd",
      "customer",
      "worker",
      "street",
      "city",
      "state",
      "zip",
      "amountDueCents",
      "paidCents",
      "customerConfirmedAt",
      "createdAt",
    ];

    const rows = jobs.map((job) => {
      const paidCents = job.payments
        .filter((payment) => payment.status === "succeeded")
        .reduce((sum, payment) => sum + payment.amountCents, 0);

      return {
        jobId: job.id,
        status: job.status,
        scheduledStart: job.scheduledStart.toISOString(),
        scheduledEnd: job.scheduledEnd.toISOString(),
        customer: job.customer.name,
        worker: job.assignedWorker?.name || "",
        street: job.street,
        city: job.city,
        state: job.state,
        zip: job.zip,
        amountDueCents: job.amountDueCents,
        paidCents,
        customerConfirmedAt: job.customerConfirmedAt?.toISOString() || "",
        createdAt: job.createdAt.toISOString(),
      };
    });

    const csv = toCsv(headers, rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="jobs-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });
}
