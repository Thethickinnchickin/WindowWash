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

    const smsLogs = await prisma.smsLog.findMany({
      where: {
        ...(from || to
          ? {
              createdAt: {
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
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5000,
    });

    const headers = [
      "smsLogId",
      "jobId",
      "customer",
      "toPhoneE164",
      "templateKey",
      "status",
      "providerMessageId",
      "error",
      "createdAt",
    ];

    const rows = smsLogs.map((log) => ({
      smsLogId: log.id,
      jobId: log.jobId,
      customer: log.customer.name,
      toPhoneE164: log.toPhoneE164,
      templateKey: log.templateKey,
      status: log.status,
      providerMessageId: log.providerMessageId || "",
      error: log.error || "",
      createdAt: log.createdAt.toISOString(),
    }));

    const csv = toCsv(headers, rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="sms-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });
}
