import Stripe from "stripe";
import { withApiErrorHandling } from "@/lib/api";
import { enqueueStripeWebhookProcessJob } from "@/lib/queue/background-queue";
import { requireStripe, requireStripeWebhookSecret } from "@/lib/stripe";
import { jsonData } from "@/lib/errors";
import {
  ingestStripeWebhookEvent,
  processStripeWebhookEventById,
} from "@/lib/stripe-webhook-queue";
import { logger } from "@/lib/logger";

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

    const stored = await ingestStripeWebhookEvent(event);
    const enqueue = await enqueueStripeWebhookProcessJob({
      stripeWebhookEventRecordId: stored.id,
    });

    if (enqueue.queued) {
      return jsonData({
        received: true,
        processing: "queued",
        queueJobId: enqueue.jobId,
      });
    }

    try {
      const result = await processStripeWebhookEventById({
        eventId: stored.id,
        stripe,
      });

      return jsonData({
        received: true,
        processing: `sync_${result.status}`,
        queue: enqueue,
      });
    } catch (error) {
      logger.warn("Stripe webhook queued for retry", {
        stripeEventId: event.id,
        type: event.type,
        error: error instanceof Error ? error.message : String(error),
      });

      return jsonData({
        received: true,
        processing: "failed_will_retry_via_reconcile",
        queue: enqueue,
      });
    }
  });
}
