import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { jsonData } from "@/lib/errors";
import { withIdempotency } from "@/lib/idempotency";
import { findJobForUser } from "@/lib/job-access";
import {
  computeRemainingDueCents,
  derivePaymentType,
  getSucceededPaymentTotalCents,
} from "@/lib/payments";
import { assertCollectPaymentAllowed } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendSmsForJob } from "@/lib/sms/service";
import { cashPaymentSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    const { id: jobId } = await context.params;
    const body = await parseRequestBody(request, cashPaymentSchema);

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
      endpoint: "payments.cash",
      userId: user.id,
      jobId,
      action: async () => {
        const output = await prisma.$transaction(async (tx) => {
          const paidCents = await getSucceededPaymentTotalCents(tx, jobId);
          const remainingDueCents = computeRemainingDueCents(job.amountDueCents, paidCents);

          if (remainingDueCents <= 0) {
            throw {
              status: 400,
              code: "ALREADY_PAID",
              message: "Job balance is already paid",
            };
          }

          if (body.amountCents > remainingDueCents) {
            throw {
              status: 400,
              code: "INVALID_AMOUNT",
              message: `Amount cannot exceed remaining due ($${(remainingDueCents / 100).toFixed(2)})`,
            };
          }

          if (body.paymentType === "full" && body.amountCents < remainingDueCents) {
            throw {
              status: 400,
              code: "INVALID_PAYMENT_TYPE",
              message: "Full payment must match the remaining balance",
            };
          }

          if (
            (body.paymentType === "partial" || body.paymentType === "deposit") &&
            body.amountCents >= remainingDueCents
          ) {
            throw {
              status: 400,
              code: "INVALID_PAYMENT_TYPE",
              message: "Partial or deposit payment must be less than the remaining balance",
            };
          }

          const paymentType =
            body.paymentType ??
            derivePaymentType({
              amountCents: body.amountCents,
              remainingDueCents,
            });

          const payment = await tx.payment.create({
            data: {
              jobId,
              status: "succeeded",
              method: "cash",
              paymentType,
              amountCents: body.amountCents,
              note: body.note,
            },
          });

          const nextPaidCents = paidCents + body.amountCents;
          const shouldMarkPaid =
            nextPaidCents >= job.amountDueCents && (job.status === "finished" || user.role === "admin");

          const updatedJob = shouldMarkPaid
            ? await tx.job.update({
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
              })
            : null;

          await tx.jobEvent.create({
            data: {
              jobId,
              userId: user.id,
              type: "PAYMENT_RECORDED",
              metadata: {
                paymentId: payment.id,
                method: "cash",
                paymentType,
                amountCents: body.amountCents,
                status: "succeeded",
                remainingDueCents: computeRemainingDueCents(job.amountDueCents, nextPaidCents),
              },
            },
          });

          if (shouldMarkPaid) {
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
          }

          return { payment, updatedJob };
        });

        if (output.updatedJob) {
          await sendSmsForJob({
            job: output.updatedJob,
            templateKey: "PAID",
            userId: user.id,
          });
        }

        return {
          payment: output.payment,
          job: output.updatedJob || job,
        };
      },
    });

    return jsonData(result.data);
  });
}
