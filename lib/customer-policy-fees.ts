import { Prisma } from "@prisma/client";
import { createJobEvent } from "@/lib/events";
import { hasStripeConfig } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";

type PolicyAction = "reschedule" | "cancel";

type PolicyFeeResult = {
  feeAppliedCents: number;
  depositCreditCents: number;
  feeDueCents: number;
  autoChargeAttempted: boolean;
  autoChargeStatus: "succeeded" | "failed" | "not_attempted";
  paymentId: string | null;
};

async function getSucceededDepositCents(jobId: string) {
  const aggregate = await prisma.payment.aggregate({
    _sum: {
      amountCents: true,
    },
    where: {
      jobId,
      paymentType: "deposit",
      status: "succeeded",
    },
  });

  return aggregate._sum.amountCents ?? 0;
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function applyCustomerPolicyFee(params: {
  jobId: string;
  action: PolicyAction;
  baseFeeCents: number;
  userId?: string;
}) : Promise<PolicyFeeResult> {
  if (params.baseFeeCents <= 0) {
    return {
      feeAppliedCents: 0,
      depositCreditCents: 0,
      feeDueCents: 0,
      autoChargeAttempted: false,
      autoChargeStatus: "not_attempted",
      paymentId: null,
    };
  }

  const job = await prisma.job.findUnique({
    where: {
      id: params.jobId,
    },
    include: {
      customer: {
        include: {
          paymentMethods: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          },
        },
      },
    },
  });

  if (!job) {
    throw {
      status: 404,
      code: "NOT_FOUND",
      message: "Appointment not found",
    };
  }

  const succeededDepositCents = params.action === "cancel" ? await getSucceededDepositCents(job.id) : 0;
  const depositCreditCents = Math.min(params.baseFeeCents, succeededDepositCents);
  const feeDueCents = Math.max(params.baseFeeCents - depositCreditCents, 0);

  if (feeDueCents <= 0) {
    await createJobEvent({
      jobId: job.id,
      userId: params.userId,
      type: "NOTE_ADDED",
      metadata: {
        text: `Policy ${params.action} fee covered by existing deposit`,
        source: "customer_policy_fee",
        action: params.action,
        feeAppliedCents: params.baseFeeCents,
        depositCreditCents,
        feeDueCents,
      },
    });

    return {
      feeAppliedCents: params.baseFeeCents,
      depositCreditCents,
      feeDueCents,
      autoChargeAttempted: false,
      autoChargeStatus: "not_attempted",
      paymentId: null,
    };
  }

  const payment = await prisma.payment.create({
    data: {
      jobId: job.id,
      status: "pending",
      method: "card",
      paymentType: "partial",
      amountCents: feeDueCents,
      note: `policy_fee:${params.action}`,
    },
  });

  await prisma.job.update({
    where: { id: job.id },
    data: {
      amountDueCents: {
        increment: feeDueCents,
      },
    },
  });

  await prisma.jobEvent.create({
    data: {
      jobId: job.id,
      userId: params.userId,
      type: "PAYMENT_RECORDED",
      metadata: toInputJson({
        paymentId: payment.id,
        method: "card",
        paymentType: "partial",
        amountCents: feeDueCents,
        status: "pending",
        source: "customer_policy_fee",
        action: params.action,
      }),
    },
  });

  let autoChargeAttempted = false;
  let autoChargeStatus: PolicyFeeResult["autoChargeStatus"] = "not_attempted";

  const savedCard = job.customer.paymentMethods[0];
  if (hasStripeConfig() && job.customer.stripeCustomerId && savedCard) {
    autoChargeAttempted = true;
    const stripe = requireStripe();

    try {
      const intent = await stripe.paymentIntents.create({
        amount: feeDueCents,
        currency: "usd",
        customer: job.customer.stripeCustomerId,
        payment_method: savedCard.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          jobId: job.id,
          paymentId: payment.id,
          source: "customer_policy_fee",
          action: params.action,
        },
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripePaymentIntentId: intent.id,
          status: intent.status === "succeeded" ? "succeeded" : "pending",
          cardBrand: savedCard.brand,
          cardLast4: savedCard.last4,
        },
      });

      autoChargeStatus = intent.status === "succeeded" ? "succeeded" : "not_attempted";
    } catch (error) {
      autoChargeStatus = "failed";

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "failed",
          note:
            `policy_fee:${params.action}:failed:${error instanceof Error ? error.message : "stripe_error"}`.slice(
              0,
              450,
            ),
        },
      });
    }
  }

  await createJobEvent({
    jobId: job.id,
    userId: params.userId,
    type: "NOTE_ADDED",
    metadata: {
      text: `Policy ${params.action} fee applied`,
      source: "customer_policy_fee",
      action: params.action,
      feeAppliedCents: params.baseFeeCents,
      depositCreditCents,
      feeDueCents,
      autoChargeAttempted,
      autoChargeStatus,
      paymentId: payment.id,
    },
  });

  return {
    feeAppliedCents: params.baseFeeCents,
    depositCreditCents,
    feeDueCents,
    autoChargeAttempted,
    autoChargeStatus,
    paymentId: payment.id,
  };
}
