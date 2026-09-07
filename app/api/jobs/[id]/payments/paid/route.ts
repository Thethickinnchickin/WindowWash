import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { sendInvoiceEmailBestEffort } from "@/lib/email/invoice";
import { jsonData } from "@/lib/errors";
import { withIdempotency } from "@/lib/idempotency";
import {
  assignedWorkerPublicSelect,
  findJobForPaymentCollection,
  jobCustomerPublicSelect,
} from "@/lib/job-access";
import { serializeJobForUser } from "@/lib/job-presentation";
import { computeRemainingDueCents, getSucceededPaymentTotalCents } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { sendSmsForJob } from "@/lib/sms/service";
import { markPaidSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    const { id: jobId } = await context.params;
    const body = await parseRequestBody(request, markPaidSchema);

    const job = await findJobForPaymentCollection(jobId, user);

    const result = await withIdempotency({
      key: body.idempotencyKey,
      endpoint: "payments.paid",
      userId: user.id,
      jobId,
      action: async () => {
        const output = await prisma.$transaction(async (tx) => {
          const paidCents = await getSucceededPaymentTotalCents(tx, jobId);
          const remainingDueCents = computeRemainingDueCents(job.amountDueCents, paidCents);
          const shouldCreatePayment = job.status !== "paid" && remainingDueCents > 0;

          const payment = shouldCreatePayment
            ? await tx.payment.create({
                data: {
                  jobId,
                  status: "succeeded",
                  method: "manual",
                  paymentType: "full",
                  amountCents: remainingDueCents,
                  note: body.note || "Marked paid after job completion",
                },
              })
            : null;

          const updatedJob =
            job.status === "paid"
              ? job
              : await tx.job.update({
                  where: { id: jobId },
                  data: { status: "paid" },
                  include: {
                    customer: {
                      select: jobCustomerPublicSelect,
                    },
                    assignedWorker: {
                      select: assignedWorkerPublicSelect,
                    },
                  },
                });

          if (payment) {
            await tx.jobEvent.create({
              data: {
                jobId,
                userId: user.id,
                type: "PAYMENT_RECORDED",
                metadata: {
                  paymentId: payment.id,
                  method: "manual",
                  paymentType: "full",
                  amountCents: remainingDueCents,
                  status: "succeeded",
                  source: "manual_mark_paid",
                },
              },
            });
          }

          if (job.status !== "paid") {
            await tx.jobEvent.create({
              data: {
                jobId,
                userId: user.id,
                type: "STATUS_CHANGED",
                metadata: {
                  from: job.status,
                  to: "paid",
                  source: "manual_mark_paid",
                  remainingDueCents,
                },
              },
            });
          }

          return { payment, updatedJob };
        });

        if (job.status !== "paid") {
          await sendSmsForJob({
            job: output.updatedJob,
            templateKey: "PAID",
            userId: user.id,
          });
        }

        if (output.payment) {
          await sendInvoiceEmailBestEffort({
            jobId,
            paymentId: output.payment.id,
            userId: user.id,
            source: "manual_mark_paid",
          });
        }

        return {
          payment: output.payment,
          job: serializeJobForUser(output.updatedJob, user),
        };
      },
    });

    return jsonData({
      ...result.data,
      job: serializeJobForUser(result.data.job, user),
    });
  });
}
