import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { noShowSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);

    const { id } = await context.params;
    const body = await parseRequestBody(request, noShowSchema);

    const existing = await prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        isNoShow: true,
      },
    });

    if (!existing) {
      throw {
        status: 404,
        code: "NOT_FOUND",
        message: "Job not found",
      };
    }

    const nextStatus =
      body.isNoShow && !["paid", "canceled"].includes(existing.status)
        ? "needs_attention"
        : existing.status;

    const updated = await prisma.job.update({
      where: { id },
      data: {
        isNoShow: body.isNoShow,
        noShowAt: body.isNoShow ? new Date() : null,
        noShowReason: body.isNoShow ? body.reason || "Marked as no-show by admin" : null,
        status: nextStatus,
      },
    });

    await createJobEvent({
      jobId: id,
      userId: user.id,
      type: "ISSUE_REPORTED",
      metadata: {
        source: "dispatch_board",
        isNoShow: body.isNoShow,
        reason: body.reason || null,
      },
    });

    return jsonData({
      job: updated,
    });
  });
}
