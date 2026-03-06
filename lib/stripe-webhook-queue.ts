import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  handlePaymentIntentFailed,
  handlePaymentIntentSucceeded,
  handlePaymentIntentVoided,
  handleSetupIntentSucceeded,
} from "@/lib/stripe-event-handlers";

const MAX_WEBHOOK_ATTEMPTS = 5;
const RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 180];

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function nextRetryAtForAttempt(nextAttemptCount: number) {
  const minutes =
    RETRY_BACKOFF_MINUTES[Math.min(nextAttemptCount - 1, RETRY_BACKOFF_MINUTES.length - 1)];
  return new Date(Date.now() + minutes * 60_000);
}

export async function ingestStripeWebhookEvent(event: Stripe.Event) {
  return prisma.stripeWebhookEvent.upsert({
    where: {
      stripeEventId: event.id,
    },
    create: {
      stripeEventId: event.id,
      type: event.type,
      status: "pending",
      attempts: 0,
      payload: toJsonInput(event),
    },
    update: {
      type: event.type,
      payload: toJsonInput(event),
    },
  });
}

async function processStripeEvent(stripe: Stripe, event: Stripe.Event) {
  if (event.type === "payment_intent.succeeded") {
    await handlePaymentIntentSucceeded(stripe, event.data.object as Stripe.PaymentIntent);
    return;
  }

  if (event.type === "payment_intent.payment_failed") {
    await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
    return;
  }

  if (event.type === "payment_intent.canceled") {
    await handlePaymentIntentVoided(event.data.object as Stripe.PaymentIntent);
    return;
  }

  if (event.type === "setup_intent.succeeded") {
    await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
    return;
  }
}

export async function processStripeWebhookEventById(params: {
  eventId: string;
  stripe: Stripe;
}) {
  const record = await prisma.stripeWebhookEvent.findUnique({
    where: { id: params.eventId },
  });

  if (!record) {
    return {
      processed: false,
      status: "missing" as const,
    };
  }

  if (record.status === "succeeded") {
    return {
      processed: false,
      status: "already_succeeded" as const,
    };
  }

  const event = record.payload as unknown as Stripe.Event;

  try {
    await processStripeEvent(params.stripe, event);

    await prisma.stripeWebhookEvent.update({
      where: { id: record.id },
      data: {
        status: "succeeded",
        processedAt: new Date(),
        lastError: null,
        nextRetryAt: null,
      },
    });

    return {
      processed: true,
      status: "succeeded" as const,
    };
  } catch (error) {
    const nextAttempt = record.attempts + 1;
    const deadLetter = nextAttempt >= MAX_WEBHOOK_ATTEMPTS;
    const lastError = formatError(error);

    await prisma.stripeWebhookEvent.update({
      where: { id: record.id },
      data: {
        attempts: nextAttempt,
        status: deadLetter ? "dead_letter" : "retrying",
        lastError,
        nextRetryAt: deadLetter ? null : nextRetryAtForAttempt(nextAttempt),
      },
    });

    logger.error("Stripe webhook processing failed", {
      stripeEventId: record.stripeEventId,
      type: record.type,
      attempts: nextAttempt,
      deadLetter,
      error: lastError,
    });

    throw error;
  }
}

export async function retryDueStripeWebhookEvents(params: {
  stripe: Stripe;
  limit?: number;
}) {
  const limit = params.limit ?? 25;
  const now = new Date();

  const due = await prisma.stripeWebhookEvent.findMany({
    where: {
      AND: [
        {
          OR: [{ status: "pending" }, { status: "retrying" }],
        },
        {
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
      ],
    },
    orderBy: [{ nextRetryAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  let succeeded = 0;
  let failed = 0;

  for (const event of due) {
    try {
      const result = await processStripeWebhookEventById({
        eventId: event.id,
        stripe: params.stripe,
      });
      if (result.status === "succeeded") {
        succeeded += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return {
    scanned: due.length,
    succeeded,
    failed,
  };
}
