import { Prisma, PrismaClient } from "@prisma/client";

type PaymentDbClient = PrismaClient | Prisma.TransactionClient;

export async function getSucceededPaymentTotalCents(db: PaymentDbClient, jobId: string) {
  const payments = await db.payment.findMany({
    where: {
      jobId,
      status: {
        in: ["succeeded", "refunded"],
      },
    },
    select: {
      amountCents: true,
      refundedAmountCents: true,
    },
  });

  return payments.reduce((sum, payment) => {
    const net = payment.amountCents - payment.refundedAmountCents;
    return sum + Math.max(net, 0);
  }, 0);
}

export function computeRemainingDueCents(amountDueCents: number, paidCents: number) {
  return Math.max(amountDueCents - paidCents, 0);
}

export function derivePaymentType(params: {
  amountCents: number;
  remainingDueCents: number;
  preferDeposit?: boolean;
}) {
  if (params.preferDeposit) {
    return "deposit" as const;
  }

  if (params.amountCents >= params.remainingDueCents) {
    return "full" as const;
  }

  return "partial" as const;
}
