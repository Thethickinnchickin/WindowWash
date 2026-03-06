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
import { requireStripe } from "@/lib/stripe";
import { savedCardPaymentSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    const { id: jobId } = await context.params;
    const body = await parseRequestBody(request, savedCardPaymentSchema);

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

    const selectedPaymentMethod = job.customer.paymentMethods.find(
      (item) => item.id === body.customerPaymentMethodId,
    );

    if (!selectedPaymentMethod) {
      throw {
        status: 404,
        code: "SAVED_CARD_NOT_FOUND",
        message: "Saved card not found for customer",
      };
    }

    if (!job.customer.stripeCustomerId) {
      throw {
        status: 400,
        code: "NO_STRIPE_CUSTOMER",
        message: "Customer does not have a Stripe customer profile",
      };
    }
    const stripeCustomerId = job.customer.stripeCustomerId;

    const stripe = requireStripe();

    const result = await withIdempotency({
      key: body.idempotencyKey,
      endpoint: "payments.saved_card",
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
            cardBrand: selectedPaymentMethod.brand,
            cardLast4: selectedPaymentMethod.last4,
          },
        });

        try {
          const intent = await stripe.paymentIntents.create(
            {
              amount: body.amountCents,
              currency: "usd",
              customer: stripeCustomerId,
              payment_method: selectedPaymentMethod.stripePaymentMethodId,
              off_session: true,
              confirm: true,
              metadata: {
                jobId,
                paymentId: payment.id,
                requestedBy: user.id,
                source: "saved_card",
              },
            },
            {
              idempotencyKey: body.idempotencyKey,
            },
          );

          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              stripePaymentIntentId: intent.id,
            },
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
              source: "saved_card",
            },
          });

          return {
            paymentId: payment.id,
            paymentIntentId: intent.id,
            paymentIntentStatus: intent.status,
          };
        } catch (error) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "failed",
            },
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
              status: "failed",
              source: "saved_card",
              error: error instanceof Error ? error.message : "stripe_error",
            },
          });

          throw error;
        }
      },
    });

    return jsonData(result.data);
  });
}
