import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cancelSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);
    const { id } = await context.params;
    const body = await parseRequestBody(request, cancelSchema);

    const existing = await prisma.job.findUnique({ where: { id } });

    if (!existing) {
      throw {
        status: 404,
        code: "NOT_FOUND",
        message: "Job not found",
      };
    }

    const job = await prisma.job.update({
      where: { id },
      data: { status: "canceled" },
    });

    await createJobEvent({
      jobId: id,
      userId: user.id,
      type: "JOB_CANCELED",
      metadata: {
        reason: body.reason,
      },
    });

    if (existing.status !== "canceled") {
      await createJobEvent({
        jobId: id,
        userId: user.id,
        type: "STATUS_CHANGED",
        metadata: {
          from: existing.status,
          to: "canceled",
          by: "admin",
        },
      });
    }

    return jsonData({ job });
  });
}
