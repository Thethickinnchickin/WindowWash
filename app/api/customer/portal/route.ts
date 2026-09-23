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

function metadataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function receiptFromEvent(event: {
  id: string;
  createdAt: Date;
  metadata: unknown;
}) {
  const metadata = metadataRecord(event.metadata);
  const invoiceNumber = typeof metadata.invoiceNumber === "string" ? metadata.invoiceNumber : null;

  if (!invoiceNumber) {
    return null;
  }

  return {
    id: event.id,
    invoiceNumber,
    documentType: metadata.documentType === "invoice" ? "invoice" : "receipt",
    status: typeof metadata.status === "string" ? metadata.status : "saved",
    emailTo: typeof metadata.emailTo === "string" ? metadata.emailTo : null,
    paymentId: typeof metadata.paymentId === "string" ? metadata.paymentId : null,
    createdAt: event.createdAt.toISOString(),
    downloadUrl: `/api/customer/receipts/${event.id}`,
  };
}

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
        events: {
          where: {
            type: "NOTE_ADDED",
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 12,
          select: {
            id: true,
            createdAt: true,
            metadata: true,
          },
        },
      },
      orderBy: {
        scheduledStart: "desc",
      },
      take: 50,
    });

    const jobsWithReceipts = jobs.map((job) => ({
      ...job,
      receipts: job.events.map(receiptFromEvent).filter((receipt) => receipt !== null),
      events: undefined,
    }));

    return jsonData({
      customer: account.customer,
      jobs: jobsWithReceipts,
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
