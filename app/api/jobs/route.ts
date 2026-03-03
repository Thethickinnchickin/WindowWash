import { NextRequest } from "next/server";
import { startOfDay, addDays } from "date-fns";
import { withApiErrorHandling } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { jsonData } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

function toDate(value: string | null, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "mine";
    const from = toDate(searchParams.get("from"), startOfDay(new Date()));
    const to = toDate(searchParams.get("to"), addDays(from, 7));
    const status = searchParams.get("status");
    const q = searchParams.get("q")?.trim();

    const where = {
      scheduledStart: {
        gte: from,
        lte: to,
      },
      ...(scope === "mine" || user.role === "worker" ? { assignedWorkerId: user.id } : {}),
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              {
                customer: {
                  name: {
                    contains: q,
                    mode: "insensitive" as const,
                  },
                },
              },
              { street: { contains: q, mode: "insensitive" as const } },
              { city: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const jobs = await prisma.job.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phoneE164: true,
            smsOptOut: true,
            email: true,
          },
        },
        assignedWorker: {
          select: {
            id: true,
            name: true,
          },
        },
        payments: {
          select: {
            id: true,
            status: true,
            amountCents: true,
            method: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        scheduledStart: "asc",
      },
    });

    return jsonData({ jobs });
  });
}
