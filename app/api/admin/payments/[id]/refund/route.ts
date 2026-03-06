import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { jsonData } from "@/lib/errors";
import { computeRemainingDueCents, getSucceededPaymentTotalCents } from "@/lib/payments";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";
import { adminPaymentRefundSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);
    const { id: paymentId } = await context.params;
    const body = await parseRequestBody(request, adminPaymentRefundSchema);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        job: true,
      },
    });

    if (!payment) {
      throw {
        status: 404,
        code: "NOT_FOUND",
        message: "Payment not found",
      };
    }

    if (payment.status !== "succeeded" && payment.status !== "refunded") {
      throw {
        status: 400,
        code: "INVALID_PAYMENT_STATUS",
        message: "Only succeeded payments can be refunded",
      };
    }

    const maxRefundableCents = Math.max(payment.amountCents - payment.refundedAmountCents, 0);

    if (maxRefundableCents <= 0) {
      throw {
        status: 400,
        code: "ALREADY_REFUNDED",
        message: "Payment is already fully refunded",
      };
    }

    const refundAmountCents = body.amountCents ?? maxRefundableCents;

    if (refundAmountCents > maxRefundableCents) {
      throw {
        status: 400,
        code: "INVALID_REFUND_AMOUNT",
        message: `Refund amount cannot exceed $${(maxRefundableCents / 100).toFixed(2)}`,
      };
    }

    const reason = body.reason || undefined;

    if (payment.method === "card") {
      if (!payment.stripePaymentIntentId) {
        throw {
          status: 400,
          code: "MISSING_PAYMENT_INTENT",
          message: "Card payment is missing Stripe payment intent id",
        };
      }

      const stripe = requireStripe();
      const refundRecord = await prisma.paymentRefund.create({
        data: {
          paymentId: payment.id,
          status: "pending",
          amountCents: refundAmountCents,
          reason,
        },
      });

      try {
        const stripeRefund = await stripe.refunds.create({
          payment_intent: payment.stripePaymentIntentId,
          amount: refundAmountCents,
          ...(reason ? { metadata: { reason } } : {}),
        });

        const stripeRefundStatus =
          stripeRefund.status === "succeeded"
            ? "succeeded"
            : stripeRefund.status === "failed" || stripeRefund.status === "canceled"
              ? "failed"
              : "pending";

        if (stripeRefundStatus === "failed") {
          await prisma.paymentRefund.update({
            where: { id: refundRecord.id },
            data: {
              status: "failed",
              stripeRefundId: stripeRefund.id,
              failureReason: stripeRefund.failure_reason || "stripe_refund_failed",
            },
          });

          throw {
            status: 400,
            code: "REFUND_FAILED",
            message: stripeRefund.failure_reason || "Stripe refund failed",
          };
        }

        if (stripeRefundStatus === "pending") {
          const pendingRefund = await prisma.paymentRefund.update({
            where: { id: refundRecord.id },
            data: {
              status: "pending",
              stripeRefundId: stripeRefund.id,
              failureReason: null,
            },
          });

          await prisma.jobEvent.create({
            data: {
              jobId: payment.jobId,
              userId: user.id,
              type: "PAYMENT_RECORDED",
              metadata: {
                paymentId: payment.id,
                refundId: pendingRefund.id,
                action: "refund_requested",
                method: payment.method,
                amountCents: refundAmountCents,
                stripeRefundId: stripeRefund.id,
                reason,
              },
            },
          });

          return jsonData({
            payment,
            refund: pendingRefund,
            remainingDueCents: computeRemainingDueCents(
              payment.job.amountDueCents,
              await getSucceededPaymentTotalCents(prisma, payment.jobId),
            ),
          });
        }

        const nextRefundedAmount = payment.refundedAmountCents + refundAmountCents;
        const fullyRefunded = nextRefundedAmount >= payment.amountCents;

        const result = await prisma.$transaction(async (tx) => {
          const updatedPayment = await tx.payment.update({
            where: { id: payment.id },
            data: {
              refundedAmountCents: nextRefundedAmount,
              status: fullyRefunded ? "refunded" : payment.status,
              refundedAt: fullyRefunded ? new Date() : null,
            },
          });

          const updatedRefund = await tx.paymentRefund.update({
            where: { id: refundRecord.id },
            data: {
              status: "succeeded",
              stripeRefundId: stripeRefund.id,
              failureReason: null,
            },
          });

          await tx.jobEvent.create({
            data: {
              jobId: payment.jobId,
              userId: user.id,
              type: "PAYMENT_RECORDED",
              metadata: {
                paymentId: payment.id,
                refundId: updatedRefund.id,
                action: "refund",
                method: payment.method,
                amountCents: refundAmountCents,
                remainingRefundableCents: Math.max(updatedPayment.amountCents - nextRefundedAmount, 0),
                stripeRefundId: stripeRefund.id,
                reason,
              },
            },
          });

          const netPaidCents = await getSucceededPaymentTotalCents(tx, payment.jobId);
          const remainingDueCents = computeRemainingDueCents(payment.job.amountDueCents, netPaidCents);

          if (payment.job.status === "paid" && remainingDueCents > 0) {
            await tx.job.update({
              where: { id: payment.jobId },
              data: {
                status: "finished",
              },
            });

            await tx.jobEvent.create({
              data: {
                jobId: payment.jobId,
                userId: user.id,
                type: "STATUS_CHANGED",
                metadata: {
                  from: "paid",
                  to: "finished",
                  source: "admin_refund",
                  remainingDueCents,
                },
              },
            });
          }

          return {
            updatedPayment,
            updatedRefund,
            remainingDueCents,
          };
        });

        return jsonData({
          payment: result.updatedPayment,
          refund: result.updatedRefund,
          remainingDueCents: result.remainingDueCents,
        });
      } catch (error) {
        await prisma.paymentRefund.update({
          where: { id: refundRecord.id },
          data: {
            status: "failed",
            failureReason: error instanceof Error ? error.message : String(error),
          },
        });

        throw {
          status: 400,
          code: "REFUND_FAILED",
          message: error instanceof Error ? error.message : "Refund failed",
        };
      }
    }

    const nextRefundedAmount = payment.refundedAmountCents + refundAmountCents;
    const fullyRefunded = nextRefundedAmount >= payment.amountCents;

    const result = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundedAmountCents: nextRefundedAmount,
          status: fullyRefunded ? "refunded" : payment.status,
          refundedAt: fullyRefunded ? new Date() : null,
        },
      });

      const refund = await tx.paymentRefund.create({
        data: {
          paymentId: payment.id,
          status: "succeeded",
          amountCents: refundAmountCents,
          reason,
        },
      });

      await tx.jobEvent.create({
        data: {
          jobId: payment.jobId,
          userId: user.id,
          type: "PAYMENT_RECORDED",
          metadata: {
            paymentId: payment.id,
            refundId: refund.id,
            action: "refund",
            method: payment.method,
            amountCents: refundAmountCents,
            reason,
          },
        },
      });

      const netPaidCents = await getSucceededPaymentTotalCents(tx, payment.jobId);
      const remainingDueCents = computeRemainingDueCents(payment.job.amountDueCents, netPaidCents);

      if (payment.job.status === "paid" && remainingDueCents > 0) {
        await tx.job.update({
          where: { id: payment.jobId },
          data: {
            status: "finished",
          },
        });

        await tx.jobEvent.create({
          data: {
            jobId: payment.jobId,
            userId: user.id,
            type: "STATUS_CHANGED",
            metadata: {
              from: "paid",
              to: "finished",
              source: "admin_refund",
              remainingDueCents,
            },
          },
        });
      }

      return {
        updatedPayment,
        refund,
        remainingDueCents,
      };
    });

    return jsonData({
      payment: result.updatedPayment,
      refund: result.refund,
      remainingDueCents: result.remainingDueCents,
    });
  });
}
