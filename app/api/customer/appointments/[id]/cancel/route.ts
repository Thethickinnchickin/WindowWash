import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireCustomerSessionAccount } from "@/lib/customer-auth";
import { applyCustomerPolicyFee } from "@/lib/customer-policy-fees";
import { assertCustomerCanCancel, getCancelPolicyFeeCents } from "@/lib/customer-policy";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { customerCancelSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const account = await requireCustomerSessionAccount();
    const { id } = await context.params;
    const body = await parseRequestBody(request, customerCancelSchema);

    const job = await prisma.job.findFirst({
      where: {
        id,
        customerId: account.customerId,
      },
    });

    if (!job) {
      throw {
        status: 404,
        code: "NOT_FOUND",
        message: "Appointment not found",
      };
    }

    assertCustomerCanCancel({
      status: job.status,
      scheduledStart: job.scheduledStart,
    });

    const policyBaseFeeCents = getCancelPolicyFeeCents(job.scheduledStart);
    const feeResult =
      policyBaseFeeCents > 0
        ? await applyCustomerPolicyFee({
            jobId: job.id,
            action: "cancel",
            baseFeeCents: policyBaseFeeCents,
          })
        : {
            feeAppliedCents: 0,
            depositCreditCents: 0,
            feeDueCents: 0,
            autoChargeAttempted: false,
            autoChargeStatus: "not_attempted" as const,
            paymentId: null,
          };

    const updated = await prisma.job.update({
      where: {
        id: job.id,
      },
      data: {
        status: "canceled",
      },
    });

    await createJobEvent({
      jobId: job.id,
      type: "JOB_CANCELED",
      metadata: {
        source: "customer_portal",
        reason: body.reason || "Canceled by customer",
        policyFee: feeResult,
      },
    });

    if (job.status !== "canceled") {
      await createJobEvent({
        jobId: job.id,
        type: "STATUS_CHANGED",
        metadata: {
          from: job.status,
          to: "canceled",
          source: "customer_portal",
        },
      });
    }

    return jsonData({
      job: updated,
      policy: {
        action: "cancel",
        ...feeResult,
      },
    });
  });
}
