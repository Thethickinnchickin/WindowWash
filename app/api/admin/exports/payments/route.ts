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

    const payments = await prisma.payment.findMany({
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
        job: {
          select: {
            id: true,
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5000,
    });

    const headers = [
      "paymentId",
      "jobId",
      "customer",
      "status",
      "method",
      "paymentType",
      "amountCents",
      "refundedAmountCents",
      "stripePaymentIntentId",
      "cardBrand",
      "cardLast4",
      "createdAt",
    ];

    const rows = payments.map((payment) => ({
      paymentId: payment.id,
      jobId: payment.job.id,
      customer: payment.job.customer.name,
      status: payment.status,
      method: payment.method,
      paymentType: payment.paymentType,
      amountCents: payment.amountCents,
      refundedAmountCents: payment.refundedAmountCents,
      stripePaymentIntentId: payment.stripePaymentIntentId || "",
      cardBrand: payment.cardBrand || "",
      cardLast4: payment.cardLast4 || "",
      createdAt: payment.createdAt.toISOString(),
    }));

    const csv = toCsv(headers, rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="payments-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });
}
