import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { pickBestWorkerForSlot } from "@/lib/availability";
import { requireCustomerSessionAccount } from "@/lib/customer-auth";
import { applyCustomerPolicyFee } from "@/lib/customer-policy-fees";
import { assertCustomerCanReschedule, getReschedulePolicyFeeCents } from "@/lib/customer-policy";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { customerRescheduleSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const account = await requireCustomerSessionAccount();
    const { id } = await context.params;
    const body = await parseRequestBody(request, customerRescheduleSchema);

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

    assertCustomerCanReschedule({
      status: job.status,
      scheduledStart: job.scheduledStart,
    });

    const policyBaseFeeCents = getReschedulePolicyFeeCents(job.scheduledStart);
    const feeResult =
      policyBaseFeeCents > 0
        ? await applyCustomerPolicyFee({
            jobId: job.id,
            action: "reschedule",
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

    const scheduledStart = new Date(body.scheduledStart);
    const scheduledEnd = new Date(
      scheduledStart.getTime() + body.estimatedDurationMinutes * 60_000,
    );

    if (scheduledEnd.getTime() <= scheduledStart.getTime()) {
      throw {
        status: 400,
        code: "INVALID_SCHEDULE_WINDOW",
        message: "Scheduled end must be after scheduled start",
      };
    }

    const selectedWorker = await pickBestWorkerForSlot({
      state: job.state,
      start: scheduledStart,
      end: scheduledEnd,
      excludeJobId: job.id,
      preferredWorkerId: job.assignedWorkerId,
    });

    if (!selectedWorker) {
      throw {
        status: 409,
        code: "NO_AVAILABILITY",
        message: "No workers are available for that start time. Please choose another slot.",
      };
    }

    const updated = await prisma.job.update({
      where: {
        id: job.id,
      },
      data: {
        scheduledStart,
        scheduledEnd,
        assignedWorkerId: selectedWorker.id,
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
      jobId: job.id,
      type: "JOB_RESCHEDULED",
      metadata: {
        source: "customer_portal",
        previousScheduledStart: job.scheduledStart.toISOString(),
        previousScheduledEnd: job.scheduledEnd.toISOString(),
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
        assignedWorkerId: selectedWorker.id,
        policyFee: feeResult,
      },
    });

    return jsonData({
      job: updated,
      policy: {
        action: "reschedule",
        ...feeResult,
      },
    });
  });
}
