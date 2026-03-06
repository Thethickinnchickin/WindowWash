import { withApiErrorHandling } from "@/lib/api";
import { requireCustomerSessionAccount } from "@/lib/customer-auth";
import {
  getCustomerCancelCutoffHours,
  getCustomerCancelFeeCents,
  getCustomerCancelFeeWindowHours,
  getCustomerRescheduleCutoffHours,
  getCustomerRescheduleFeeCents,
  getCustomerRescheduleFeeWindowHours,
} from "@/lib/customer-policy";
import { jsonData } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return withApiErrorHandling(async () => {
    const account = await requireCustomerSessionAccount();

    const jobs = await prisma.job.findMany({
      where: {
        customerId: account.customerId,
      },
      include: {
        assignedWorker: {
          select: {
            id: true,
            name: true,
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
          take: 3,
        },
      },
      orderBy: {
        scheduledStart: "desc",
      },
      take: 50,
    });

    return jsonData({
      customer: account.customer,
      jobs,
      policy: {
        reschedule: {
          cutoffHours: getCustomerRescheduleCutoffHours(),
          feeWindowHours: getCustomerRescheduleFeeWindowHours(),
          feeCents: getCustomerRescheduleFeeCents(),
        },
        cancel: {
          cutoffHours: getCustomerCancelCutoffHours(),
          feeWindowHours: getCustomerCancelFeeWindowHours(),
          feeCents: getCustomerCancelFeeCents(),
        },
      },
    });
  });
}
