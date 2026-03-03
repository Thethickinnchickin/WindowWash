import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
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

    const job = await prisma.job.update({
      where: { id },
      data: {
        scheduledStart: new Date(body.scheduledStart),
        scheduledEnd: new Date(body.scheduledEnd),
      },
    });

    await createJobEvent({
      jobId: id,
      userId: user.id,
      type: "JOB_RESCHEDULED",
      metadata: {
        scheduledStart: body.scheduledStart,
        scheduledEnd: body.scheduledEnd,
      },
    });

    return jsonData({ job });
  });
}
