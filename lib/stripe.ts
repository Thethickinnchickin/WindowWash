import Stripe from "stripe";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/errors";

export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      appInfo: {
        name: "windowwash",
      },
    })
  : null;

export function requireStripe() {
  if (!stripe) {
    throw new HttpError(
      503,
      "STRIPE_NOT_CONFIGURED",
      "Stripe is not configured in this environment",
    );
  }

  return stripe;
}

export function requireStripeWebhookSecret() {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new HttpError(
      503,
      "STRIPE_NOT_CONFIGURED",
      "Stripe webhook secret is not configured",
    );
  }

  return env.STRIPE_WEBHOOK_SECRET;
}
