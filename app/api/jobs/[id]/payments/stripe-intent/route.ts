import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { withIdempotency } from "@/lib/idempotency";
import { findJobForUser } from "@/lib/job-access";
import {
  computeRemainingDueCents,
  derivePaymentType,
  getSucceededPaymentTotalCents,
} from "@/lib/payments";
import { assertCollectPaymentAllowed } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { paymentIntentSchema } from "@/lib/validators";
import { requireStripe } from "@/lib/stripe";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    const { id: jobId } = await context.params;
    const body = await parseRequestBody(request, paymentIntentSchema);

    const job = await findJobForUser(jobId, user);

    assertCollectPaymentAllowed(user, job.status);

    if (job.status === "paid") {
      throw {
        status: 400,
        code: "ALREADY_PAID",
        message: "Job is already paid",
      };
    }

    const paidCents = await getSucceededPaymentTotalCents(prisma, jobId);
    const remainingDueCents = computeRemainingDueCents(job.amountDueCents, paidCents);

    if (remainingDueCents <= 0) {
      throw {
        status: 400,
        code: "ALREADY_PAID",
        message: "Job balance is already paid",
      };
    }

    if (body.amountCents > remainingDueCents) {
      throw {
        status: 400,
        code: "INVALID_AMOUNT",
        message: `Amount cannot exceed remaining due ($${(remainingDueCents / 100).toFixed(2)})`,
      };
    }

    if (body.paymentType === "full" && body.amountCents < remainingDueCents) {
      throw {
        status: 400,
        code: "INVALID_PAYMENT_TYPE",
        message: "Full payment must match the remaining balance",
      };
    }

    if (
      (body.paymentType === "partial" || body.paymentType === "deposit") &&
      body.amountCents >= remainingDueCents
    ) {
      throw {
        status: 400,
        code: "INVALID_PAYMENT_TYPE",
        message: "Partial or deposit payment must be less than the remaining balance",
      };
    }

    const paymentType =
      body.paymentType ??
      derivePaymentType({
        amountCents: body.amountCents,
        remainingDueCents,
      });

    const stripe = requireStripe();

    const result = await withIdempotency({
      key: body.idempotencyKey,
      endpoint: "payments.stripe_intent",
      userId: user.id,
      jobId,
      action: async () => {
        const payment = await prisma.payment.create({
          data: {
            jobId,
            status: "pending",
            method: "card",
            paymentType,
            amountCents: body.amountCents,
          },
        });

        const intent = await stripe.paymentIntents.create(
          {
            amount: body.amountCents,
            currency: "usd",
            automatic_payment_methods: { enabled: true },
            metadata: {
              jobId,
              paymentId: payment.id,
              requestedBy: user.id,
            },
          },
          {
            idempotencyKey: body.idempotencyKey,
          },
        );

        await prisma.payment.update({
          where: { id: payment.id },
          data: { stripePaymentIntentId: intent.id },
        });

        await createJobEvent({
          jobId,
          userId: user.id,
          type: "PAYMENT_RECORDED",
          metadata: {
            paymentId: payment.id,
            method: "card",
            paymentType,
            amountCents: body.amountCents,
            status: "pending",
          },
        });

        return {
          paymentId: payment.id,
          paymentIntentId: intent.id,
          clientSecret: intent.client_secret,
          amountCents: body.amountCents,
        };
      },
    });

    return jsonData(result.data);
  });
}
