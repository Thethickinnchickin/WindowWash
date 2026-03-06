import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { jobSchema } from "@/lib/validators";

const jobPatchSchema = jobSchema.partial();

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);
    const { id } = await context.params;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        customer: true,
        assignedWorker: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        events: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            refunds: {
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
        smsLogs: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!job) {
      throw {
        status: 404,
        code: "NOT_FOUND",
        message: "Job not found",
      };
    }

    return jsonData({ job });
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);
    const { id } = await context.params;

    const body = await parseRequestBody(request, jobPatchSchema);

    const existing = await prisma.job.findUnique({ where: { id } });
    if (!existing) {
      throw {
        status: 404,
        code: "NOT_FOUND",
        message: "Job not found",
      };
    }

    const nextScheduledStart = body.scheduledStart ? new Date(body.scheduledStart) : null;
    let nextScheduledEnd = body.scheduledEnd ? new Date(body.scheduledEnd) : null;

    if (nextScheduledStart && !nextScheduledEnd) {
      const currentDurationMs = existing.scheduledEnd.getTime() - existing.scheduledStart.getTime();
      const requestedDurationMs = body.estimatedDurationMinutes
        ? body.estimatedDurationMinutes * 60_000
        : null;
      const fallbackDurationMs = 120 * 60_000;
      const durationMs = requestedDurationMs || (currentDurationMs > 0 ? currentDurationMs : fallbackDurationMs);
      nextScheduledEnd = new Date(nextScheduledStart.getTime() + durationMs);
    }

    if (nextScheduledStart && nextScheduledEnd && nextScheduledEnd.getTime() <= nextScheduledStart.getTime()) {
      throw {
        status: 400,
        code: "INVALID_SCHEDULE_WINDOW",
        message: "Scheduled end must be after scheduled start",
      };
    }

    const updated = await prisma.job.update({
      where: { id },
      data: {
        ...(body.customerId ? { customerId: body.customerId } : {}),
        ...(typeof body.assignedWorkerId !== "undefined"
          ? { assignedWorkerId: body.assignedWorkerId }
          : {}),
        ...(nextScheduledStart ? { scheduledStart: nextScheduledStart } : {}),
        ...(nextScheduledEnd ? { scheduledEnd: nextScheduledEnd } : {}),
        ...(typeof body.amountDueCents === "number" ? { amountDueCents: body.amountDueCents } : {}),
        ...(typeof body.notes !== "undefined" ? { notes: body.notes } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.street ? { street: body.street } : {}),
        ...(body.city ? { city: body.city } : {}),
        ...(body.state ? { state: body.state } : {}),
        ...(body.zip ? { zip: body.zip } : {}),
      },
    });

    await createJobEvent({
      jobId: id,
      userId: user.id,
      type: "JOB_UPDATED",
      metadata: {
        changes: body,
      },
    });

    if (body.status && body.status !== existing.status) {
      await createJobEvent({
        jobId: id,
        userId: user.id,
        type: "STATUS_CHANGED",
        metadata: {
          from: existing.status,
          to: body.status,
          by: "admin",
        },
      });
    }

    return jsonData({ job: updated });
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);
    const { id } = await context.params;

    await prisma.job.delete({ where: { id } });

    return jsonData({ ok: true });
  });
}

export const jobUpdateSchema = z.object({
  id: z.string(),
});
