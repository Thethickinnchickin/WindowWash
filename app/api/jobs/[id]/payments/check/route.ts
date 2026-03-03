import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { withIdempotency } from "@/lib/idempotency";
import { findJobForUser } from "@/lib/job-access";
import { assertCollectPaymentAllowed } from "@/lib/permissions";
import { jsonData } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { sendSmsForJob } from "@/lib/sms/service";
import { checkPaymentSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    const { id: jobId } = await context.params;
    const body = await parseRequestBody(request, checkPaymentSchema);

    const job = await findJobForUser(jobId, user);
    assertCollectPaymentAllowed(user, job.status);

    if (job.status === "paid") {
      throw {
        status: 400,
        code: "ALREADY_PAID",
        message: "Job is already paid",
      };
    }

    const result = await withIdempotency({
      key: body.idempotencyKey,
      endpoint: "payments.check",
      userId: user.id,
      jobId,
      action: async () => {
        const output = await prisma.$transaction(async (tx) => {
          const payment = await tx.payment.create({
            data: {
              jobId,
              status: "succeeded",
              method: "check",
              amountCents: body.amountCents,
              checkNumber: body.checkNumber,
            },
          });

          const updatedJob = await tx.job.update({
            where: { id: jobId },
            data: { status: "paid" },
            include: {
              customer: true,
              assignedWorker: {
                select: {
                  name: true,
                },
              },
            },
          });

          await tx.jobEvent.create({
            data: {
              jobId,
              userId: user.id,
              type: "PAYMENT_RECORDED",
              metadata: {
                paymentId: payment.id,
                method: "check",
                amountCents: body.amountCents,
                checkNumber: body.checkNumber,
                status: "succeeded",
              },
            },
          });

          await tx.jobEvent.create({
            data: {
              jobId,
              userId: user.id,
              type: "STATUS_CHANGED",
              metadata: {
                from: job.status,
                to: "paid",
              },
            },
          });

          return { payment, updatedJob };
        });

        await sendSmsForJob({
          job: output.updatedJob,
          templateKey: "PAID",
          userId: user.id,
        });

        return {
          payment: output.payment,
          job: output.updatedJob,
        };
      },
    });

    return jsonData(result.data);
  });
}
