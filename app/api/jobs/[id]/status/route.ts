import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { withIdempotency } from "@/lib/idempotency";
import { findJobForUser } from "@/lib/job-access";
import { canWorkerTransitionStatus } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { templateKeyForStatus, sendSmsForJob } from "@/lib/sms/service";
import { statusUpdateSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    const { id: jobId } = await context.params;
    const body = await parseRequestBody(request, statusUpdateSchema);

    const job = await findJobForUser(jobId, user);

    if (job.status === "canceled") {
      throw {
        status: 400,
        code: "JOB_CANCELED",
        message: "Canceled jobs cannot be updated by workers",
      };
    }

    if (user.role === "worker") {
      if (body.status === "paid") {
        throw {
          status: 400,
          code: "INVALID_STATUS",
          message: "Use payment collection to move a job to paid",
        };
      }

      if (!canWorkerTransitionStatus(job.status, body.status) && job.status !== body.status) {
        throw {
          status: 400,
          code: "INVALID_STATUS_TRANSITION",
          message: `Cannot move from ${job.status} to ${body.status}`,
        };
      }
    }

    const result = await withIdempotency({
      key: body.idempotencyKey,
      endpoint: "jobs.status",
      userId: user.id,
      jobId,
      action: async () => {
        const updated =
          job.status === body.status
            ? job
            : await prisma.job.update({
                where: { id: jobId },
                data: { status: body.status },
                include: {
                  customer: true,
                  assignedWorker: {
                    select: {
                      name: true,
                    },
                  },
                },
              });

        if (job.status !== body.status) {
          await createJobEvent({
            jobId,
            userId: user.id,
            type: "STATUS_CHANGED",
            metadata: {
              from: job.status,
              to: body.status,
              ...(body.etaMinutes ? { etaMinutes: body.etaMinutes } : {}),
            },
          });
        }

        const templateKey = templateKeyForStatus(body.status);
        let smsResult: unknown = null;

        if (templateKey) {
          smsResult = await sendSmsForJob({
            job: updated,
            templateKey,
            userId: user.id,
            etaMinutes: body.etaMinutes,
          });
        }

        return {
          job: updated,
          sms: smsResult,
          replayed: false,
        };
      },
    });

    return jsonData(result.data);
  });
}
