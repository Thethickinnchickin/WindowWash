import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { assertWorkerCanTakeSlot } from "@/lib/availability";
import { requireSessionUser } from "@/lib/auth";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { rescheduleSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);
    const { id } = await context.params;
    const body = await parseRequestBody(request, rescheduleSchema);
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

    const existing = await prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        assignedWorkerId: true,
      },
    });

    if (!existing) {
      throw {
        status: 404,
        code: "NOT_FOUND",
        message: "Job not found",
      };
    }

    if (existing.assignedWorkerId) {
      await assertWorkerCanTakeSlot({
        workerId: existing.assignedWorkerId,
        start: scheduledStart,
        end: scheduledEnd,
        excludeJobId: id,
      });
    }

    const job = await prisma.job.update({
      where: { id },
      data: {
        scheduledStart,
        scheduledEnd,
      },
    });

    await createJobEvent({
      jobId: id,
      userId: user.id,
      type: "JOB_RESCHEDULED",
      metadata: {
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
      },
    });

    return jsonData({ job });
  });
}
