import { NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api";
import { assertWorkerCanTakeSlot } from "@/lib/availability";
import { requireSessionUser } from "@/lib/auth";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { dispatchAssignSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);

    const body = await request.json();
    const parsed = dispatchAssignSchema.safeParse({
      workerId: body.workerId,
    });

    if (!parsed.success) {
      throw {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid dispatch assignment payload",
        details: parsed.error.flatten(),
      };
    }

    const jobId = typeof body.jobId === "string" ? body.jobId : "";
    if (!jobId) {
      throw {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "jobId is required",
      };
    }

    const existing = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        assignedWorkerId: true,
        scheduledStart: true,
        scheduledEnd: true,
      },
    });

    if (!existing) {
      throw {
        status: 404,
        code: "NOT_FOUND",
        message: "Job not found",
      };
    }

    const workerId = parsed.data.workerId;

    if (workerId) {
      await assertWorkerCanTakeSlot({
        workerId,
        start: existing.scheduledStart,
        end: existing.scheduledEnd,
        excludeJobId: existing.id,
      });
    }

    const updated = await prisma.job.update({
      where: { id: existing.id },
      data: {
        assignedWorkerId: workerId,
      },
      include: {
        assignedWorker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await createJobEvent({
      jobId: existing.id,
      userId: user.id,
      type: "JOB_ASSIGNED",
      metadata: {
        source: "dispatch_board",
        fromWorkerId: existing.assignedWorkerId,
        toWorkerId: workerId,
      },
    });

    return jsonData({
      job: updated,
    });
  });
}
