import { withApiErrorHandling } from "@/lib/api";
import { requireCustomerSessionAccount } from "@/lib/customer-auth";
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
    });
  });
}
