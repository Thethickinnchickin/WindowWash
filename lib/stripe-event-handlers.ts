import Stripe from "stripe";
import { createJobEvent } from "@/lib/events";
import { getSucceededPaymentTotalCents, computeRemainingDueCents } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { sendSmsForJob } from "@/lib/sms/service";
import { storeCardOnFileFromStripe } from "@/lib/stripe-customers";

type JobForPaidSms = {
  id: string;
  customerId: string;
  amountDueCents: number;
  street: string;
  city: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  customer: {
    id: string;
    name: string;
    phoneE164: string;
    smsOptOut: boolean;
  };
  assignedWorker: {
    name: string;
  } | null;
};

async function getCardFromIntent(stripe: Stripe, intent: Stripe.PaymentIntent) {
  if (!intent.latest_charge) {
    return null;
  }

  const charge = await stripe.charges.retrieve(
    typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge.id,
  );

  const details = charge.payment_method_details as Stripe.Charge.PaymentMethodDetails | null;
  return details?.card ?? null;
}

export async function handlePaymentIntentSucceeded(stripe: Stripe, intent: Stripe.PaymentIntent) {
  const existing = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: intent.id },
    include: {
      job: {
        include: {
          customer: true,
          assignedWorker: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!existing) {
    return;
  }

  if (existing.status === "succeeded" || existing.status === "refunded") {
    return;
  }

  const card = await getCardFromIntent(stripe, intent);
  let shouldSendPaidSms = false;
  let paidJobForSms: JobForPaidSms | null = null;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: existing.id },
      data: {
        status: "succeeded",
        cardBrand: card?.brand || existing.cardBrand,
        cardLast4: card?.last4 || existing.cardLast4,
      },
    });

    const totalPaidCents = await getSucceededPaymentTotalCents(tx, existing.jobId);
    const remainingDueCents = computeRemainingDueCents(existing.job.amountDueCents, totalPaidCents);

    const canMarkPaid =
      remainingDueCents <= 0 &&
      existing.job.status !== "paid" &&
      existing.job.status === "finished";

    if (canMarkPaid) {
      paidJobForSms = await tx.job.update({
        where: { id: existing.jobId },
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
          jobId: existing.jobId,
          type: "STATUS_CHANGED",
          metadata: {
            from: "finished",
            to: "paid",
            source: "stripe_webhook",
          },
        },
      });

      shouldSendPaidSms = true;
    }

    await tx.jobEvent.create({
      data: {
        jobId: existing.jobId,
        type: "PAYMENT_RECORDED",
        metadata: {
          paymentId: existing.id,
          method: "card",
          amountCents: existing.amountCents,
          paymentType: existing.paymentType,
          status: "succeeded",
          stripePaymentIntentId: intent.id,
          remainingDueCents,
          totalPaidCents,
        },
      },
    });
  });

  if (shouldSendPaidSms && paidJobForSms) {
    await sendSmsForJob({
      job: paidJobForSms,
      templateKey: "PAID",
    });
  }
}

export async function handlePaymentIntentFailed(intent: Stripe.PaymentIntent) {
  const existing = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: intent.id },
  });

  if (!existing) {
    return;
  }

  if (existing.status === "failed" || existing.status === "voided") {
    return;
  }

  await prisma.payment.update({
    where: { id: existing.id },
    data: { status: "failed" },
  });

  await createJobEvent({
    jobId: existing.jobId,
    type: "PAYMENT_RECORDED",
    metadata: {
      paymentId: existing.id,
      method: "card",
      amountCents: existing.amountCents,
      paymentType: existing.paymentType,
      status: "failed",
      stripePaymentIntentId: intent.id,
    },
  });
}

export async function handlePaymentIntentVoided(intent: Stripe.PaymentIntent) {
  const existing = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: intent.id },
  });

  if (!existing) {
    return;
  }

  if (existing.status === "voided") {
    return;
  }

  await prisma.payment.update({
    where: { id: existing.id },
    data: {
      status: "voided",
    },
  });

  await createJobEvent({
    jobId: existing.jobId,
    type: "PAYMENT_RECORDED",
    metadata: {
      paymentId: existing.id,
      method: "card",
      amountCents: existing.amountCents,
      paymentType: existing.paymentType,
      status: "voided",
      stripePaymentIntentId: intent.id,
    },
  });
}

export async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
  const stripeCustomerId =
    typeof setupIntent.customer === "string" ? setupIntent.customer : setupIntent.customer?.id;
  const stripePaymentMethodId =
    typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id;

  if (!stripeCustomerId || !stripePaymentMethodId) {
    return;
  }

  const customer = await prisma.customer.findFirst({
    where: {
      stripeCustomerId,
    },
  });

  if (!customer) {
    return;
  }

  const existingCount = await prisma.customerPaymentMethod.count({
    where: { customerId: customer.id },
  });

  await storeCardOnFileFromStripe({
    customerId: customer.id,
    stripePaymentMethodId,
    isDefault: existingCount === 0,
  });

  const localJobId = setupIntent.metadata?.localJobId;
  if (localJobId) {
    await createJobEvent({
      jobId: localJobId,
      type: "NOTE_ADDED",
      metadata: {
        text: "Card saved on file from customer booking flow",
        source: "stripe_setup_intent_webhook",
      },
    });
  }
}
