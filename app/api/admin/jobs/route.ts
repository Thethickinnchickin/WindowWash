import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { jobSchema } from "@/lib/validators";

export async function GET() {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);

    const jobs = await prisma.job.findMany({
      include: {
        customer: true,
        assignedWorker: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
          take: 3,
        },
        smsLogs: {
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
      },
      orderBy: {
        scheduledStart: "desc",
      },
      take: 200,
    });

    return jsonData({ jobs });
  });
}

export async function POST(request: NextRequest) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);

    const body = await parseRequestBody(request, jobSchema);
    const scheduledStart = new Date(body.scheduledStart);
    const scheduledEnd = body.scheduledEnd
      ? new Date(body.scheduledEnd)
      : new Date(scheduledStart.getTime() + body.estimatedDurationMinutes * 60_000);

    if (scheduledEnd.getTime() <= scheduledStart.getTime()) {
      throw {
        status: 400,
        code: "INVALID_SCHEDULE_WINDOW",
        message: "Scheduled end must be after scheduled start",
      };
    }

    const job = await prisma.job.create({
      data: {
        customerId: body.customerId,
        assignedWorkerId: body.assignedWorkerId,
        scheduledStart,
        scheduledEnd,
        amountDueCents: body.amountDueCents,
        notes: body.notes,
        status: body.status ?? "scheduled",
        street: body.street,
        city: body.city,
        state: body.state,
        zip: body.zip,
      },
      include: {
        customer: true,
        assignedWorker: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await createJobEvent({
      jobId: job.id,
      userId: user.id,
      type: "JOB_CREATED",
      metadata: {
        amountDueCents: body.amountDueCents,
      },
    });

    if (body.assignedWorkerId) {
      await createJobEvent({
        jobId: job.id,
        userId: user.id,
        type: "JOB_ASSIGNED",
        metadata: {
          workerId: body.assignedWorkerId,
        },
      });
    }

    return jsonData({ job }, 201);
  });
}
