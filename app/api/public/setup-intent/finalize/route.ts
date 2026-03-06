import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { jsonData } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { storeCardOnFileFromStripe } from "@/lib/stripe-customers";
import { requireStripe } from "@/lib/stripe";

const finalizeSetupIntentSchema = z.object({
  setupIntentId: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  return withApiErrorHandling(async () => {
    const body = await parseRequestBody(request, finalizeSetupIntentSchema);

    const stripe = requireStripe();
    const setupIntent = await stripe.setupIntents.retrieve(body.setupIntentId);

    if (setupIntent.status !== "succeeded") {
      throw {
        status: 400,
        code: "SETUP_INTENT_NOT_SUCCEEDED",
        message: `SetupIntent is ${setupIntent.status}. Complete card confirmation first.`,
      };
    }

    const stripeCustomerId =
      typeof setupIntent.customer === "string"
        ? setupIntent.customer
        : setupIntent.customer?.id;
    const stripePaymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;

    if (!stripeCustomerId || !stripePaymentMethodId) {
      throw {
        status: 400,
        code: "SETUP_INTENT_MISSING_DATA",
        message: "SetupIntent missing customer or payment method",
      };
    }

    let customer = setupIntent.metadata?.localCustomerId
      ? await prisma.customer.findUnique({
          where: {
            id: setupIntent.metadata.localCustomerId,
          },
        })
      : null;

    if (!customer) {
      customer = await prisma.customer.findFirst({
        where: {
          stripeCustomerId,
        },
      });
    }

    if (!customer) {
      throw {
        status: 404,
        code: "CUSTOMER_NOT_FOUND",
        message: "No local customer found for this setup intent",
      };
    }

    if (!customer.stripeCustomerId) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { stripeCustomerId },
      });
    }

    const existingCount = await prisma.customerPaymentMethod.count({
      where: {
        customerId: customer.id,
      },
    });

    const saved = await storeCardOnFileFromStripe({
      customerId: customer.id,
      stripePaymentMethodId,
      isDefault: existingCount === 0,
    });

    return jsonData({
      customerId: customer.id,
      paymentMethodId: saved?.id,
      setupIntentId: setupIntent.id,
    });
  });
}
