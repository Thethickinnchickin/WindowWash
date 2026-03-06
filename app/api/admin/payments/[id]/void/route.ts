import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { jsonData } from "@/lib/errors";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";
import { adminPaymentVoidSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);
    const { id: paymentId } = await context.params;
    const body = await parseRequestBody(request, adminPaymentVoidSchema);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw {
        status: 404,
        code: "NOT_FOUND",
        message: "Payment not found",
      };
    }

    if (payment.status !== "pending") {
      throw {
        status: 400,
        code: "INVALID_PAYMENT_STATUS",
        message: "Only pending payments can be voided",
      };
    }

    if (payment.method !== "card") {
      throw {
        status: 400,
        code: "UNSUPPORTED_VOID_METHOD",
        message: "Voiding is only supported for pending card payments",
      };
    }

    if (!payment.stripePaymentIntentId) {
      throw {
        status: 400,
        code: "MISSING_PAYMENT_INTENT",
        message: "Pending card payment is missing Stripe payment intent id",
      };
    }

    const stripe = requireStripe();
    await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);

    const updated = await prisma.$transaction(async (tx) => {
      const voidedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "voided",
        },
      });

      await tx.jobEvent.create({
        data: {
          jobId: payment.jobId,
          userId: user.id,
          type: "PAYMENT_RECORDED",
          metadata: {
            paymentId: payment.id,
            action: "void",
            amountCents: payment.amountCents,
            method: payment.method,
            reason: body.reason,
          },
        },
      });

      return voidedPayment;
    });

    return jsonData({
      payment: updated,
    });
  });
}
