import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { assertAnyWorkerAvailableForSlot, assertWorkerCanTakeSlot } from "@/lib/availability";
import { requireSessionUser } from "@/lib/auth";
import { createJobEvent } from "@/lib/events";
import { geocodeAddress } from "@/lib/geocoding";
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

    const status = body.status ?? "scheduled";
    let assignedWorkerId = body.assignedWorkerId;

    if (assignedWorkerId) {
      await assertWorkerCanTakeSlot({
        workerId: assignedWorkerId,
        start: scheduledStart,
        end: scheduledEnd,
      });
    } else if (status !== "canceled") {
      const autoAssignedWorker = await assertAnyWorkerAvailableForSlot({
        state: body.state,
        start: scheduledStart,
        end: scheduledEnd,
      });
      assignedWorkerId = autoAssignedWorker.id;
    }

    const coordinates = await geocodeAddress({
      street: body.street,
      city: body.city,
      state: body.state,
      zip: body.zip,
    });

    const job = await prisma.job.create({
      data: {
        customerId: body.customerId,
        assignedWorkerId,
        scheduledStart,
        scheduledEnd,
        amountDueCents: body.amountDueCents,
        notes: body.notes,
        status,
        street: body.street,
        city: body.city,
        state: body.state,
        zip: body.zip,
        lat: coordinates?.lat,
        lng: coordinates?.lng,
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
        assignedWorkerId,
        autoAssignedWorker: Boolean(assignedWorkerId && !body.assignedWorkerId),
      },
    });

    if (assignedWorkerId) {
      await createJobEvent({
        jobId: job.id,
        userId: user.id,
        type: "JOB_ASSIGNED",
        metadata: {
          workerId: assignedWorkerId,
          source: body.assignedWorkerId ? "manual_admin" : "auto_capacity",
        },
      });
    }

    return jsonData({ job }, 201);
  });
}

