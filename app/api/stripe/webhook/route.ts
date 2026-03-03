import Stripe from "stripe";
import { withApiErrorHandling } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireStripe, requireStripeWebhookSecret } from "@/lib/stripe";
import { sendSmsForJob } from "@/lib/sms/service";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const stripe = requireStripe();
    const webhookSecret = requireStripeWebhookSecret();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      throw {
        status: 400,
        code: "MISSING_SIGNATURE",
        message: "Missing Stripe signature",
      };
    }

    const body = await request.text();

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      throw {
        status: 400,
        code: "INVALID_SIGNATURE",
        message: "Invalid Stripe signature",
        details: error instanceof Error ? error.message : String(error),
      };
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
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

      if (existing) {
        const paymentMethodDetails = intent.latest_charge
          ? ((await stripe.charges.retrieve(
              typeof intent.latest_charge === "string"
                ? intent.latest_charge
                : intent.latest_charge.id,
            )).payment_method_details as Stripe.Charge.PaymentMethodDetails | null)
          : null;

        const card = paymentMethodDetails?.card;

        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: existing.id },
            data: {
              status: "succeeded",
              cardBrand: card?.brand,
              cardLast4: card?.last4,
            },
          });

          if (existing.job.status !== "paid") {
            await tx.job.update({
              where: { id: existing.jobId },
              data: { status: "paid" },
            });

            await tx.jobEvent.create({
              data: {
                jobId: existing.jobId,
                type: "STATUS_CHANGED",
                metadata: {
                  from: existing.job.status,
                  to: "paid",
                  source: "stripe_webhook",
                },
              },
            });
          }

          await tx.jobEvent.create({
            data: {
              jobId: existing.jobId,
              type: "PAYMENT_RECORDED",
              metadata: {
                paymentId: existing.id,
                method: "card",
                amountCents: existing.amountCents,
                status: "succeeded",
                stripePaymentIntentId: intent.id,
              },
            },
          });
        });

        await sendSmsForJob({
          job: existing.job,
          templateKey: "PAID",
        });
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const existing = await prisma.payment.findFirst({
        where: { stripePaymentIntentId: intent.id },
      });

      if (existing && existing.status !== "failed") {
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
            status: "failed",
            stripePaymentIntentId: intent.id,
          },
        });
      }
    }

    return jsonData({ received: true });
  });
}
