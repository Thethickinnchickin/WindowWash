import { withApiErrorHandling } from "@/lib/api";
import { requireCustomerSessionAccount } from "@/lib/customer-auth";
import { hasStripeConfig } from "@/lib/env";
import { jsonData } from "@/lib/errors";
import { ensureStripeCustomer } from "@/lib/stripe-customers";
import { requireStripe } from "@/lib/stripe";

export async function POST() {
  return withApiErrorHandling(async () => {
    if (!hasStripeConfig()) {
      throw {
        status: 503,
        code: "STRIPE_NOT_CONFIGURED",
        message: "Stripe is not configured",
      };
    }

    const account = await requireCustomerSessionAccount();
    const stripe = requireStripe();
    const stripeCustomerId = await ensureStripeCustomer(account.customer);

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: {
        localCustomerId: account.customerId,
      },
    });

    return jsonData({
      clientSecret: setupIntent.client_secret,
    });
  });
}
