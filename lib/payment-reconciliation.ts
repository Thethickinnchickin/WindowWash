import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";
import {
  handlePaymentIntentFailed,
  handlePaymentIntentSucceeded,
  handlePaymentIntentVoided,
} from "@/lib/stripe-event-handlers";
import { retryDueStripeWebhookEvents } from "@/lib/stripe-webhook-queue";

export async function runPaymentsReconciliation(params?: {
  webhookLimit?: number;
  pendingPaymentLimit?: number;
}) {
  const stripe = requireStripe();

  const webhookResult = await retryDueStripeWebhookEvents({
    stripe,
    limit: params?.webhookLimit ?? 25,
  });

  const stalePendingPayments = await prisma.payment.findMany({
    where: {
      status: "pending",
      stripePaymentIntentId: {
        not: null,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: params?.pendingPaymentLimit ?? 50,
  });

  let paymentSynced = 0;
  let paymentFailed = 0;
  let paymentSkipped = 0;

  for (const payment of stalePendingPayments) {
    if (!payment.stripePaymentIntentId) {
      paymentSkipped += 1;
      continue;
    }

    try {
      const intent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);

      if (intent.status === "succeeded") {
        await handlePaymentIntentSucceeded(stripe, intent);
        paymentSynced += 1;
        continue;
      }

      if (intent.status === "canceled") {
        await handlePaymentIntentVoided(intent);
        paymentSynced += 1;
        continue;
      }

      if (intent.status === "requires_payment_method") {
        await handlePaymentIntentFailed(intent);
        paymentSynced += 1;
        continue;
      }

      paymentSkipped += 1;
    } catch {
      paymentFailed += 1;
    }
  }

  const deadLetterCount = await prisma.stripeWebhookEvent.count({
    where: {
      status: "dead_letter",
    },
  });

  return {
    webhook: {
      ...webhookResult,
      deadLetterCount,
    },
    pendingPaymentSync: {
      scanned: stalePendingPayments.length,
      synced: paymentSynced,
      failed: paymentFailed,
      skipped: paymentSkipped,
    },
  };
}
