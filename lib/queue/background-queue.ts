import { JobsOptions, Queue, RedisOptions } from "bullmq";
import { env } from "@/lib/env";
import type { SmsTemplateValues } from "@/lib/sms/templates";
import type { SmsTemplateKey } from "@/lib/jobs";
import { logger } from "@/lib/logger";
import { shouldDisableRedisInLocalDev } from "@/lib/redis";

const BACKGROUND_QUEUE_NAME = "windowwash-background";

export type ReminderDispatchJobData = {
  baseUrl: string;
};

export type PaymentsReconcileJobData = {
  webhookLimit?: number;
  pendingPaymentLimit?: number;
};

export type StripeWebhookProcessJobData = {
  stripeWebhookEventRecordId: string;
};

export type SmsRetryJobData = {
  jobId: string;
  templateKey: SmsTemplateKey;
  userId?: string;
  etaMinutes?: number;
  customText?: string;
  templateValues?: Partial<SmsTemplateValues>;
  retryAttempt: number;
};

export type BackgroundJobName =
  | "dispatch-reminders"
  | "reconcile-payments"
  | "process-stripe-webhook"
  | "retry-sms";

const globalForQueue = globalThis as typeof globalThis & {
  backgroundQueue?: Queue;
  backgroundQueueDisabledNoticeShown?: boolean;
};

function redisConnectionFromEnv(): RedisOptions | null {
  const redisUrl = env.REDIS_URL?.trim();
  if (!redisUrl) {
    return null;
  }

  if (shouldDisableRedisInLocalDev(redisUrl)) {
    if (!globalForQueue.backgroundQueueDisabledNoticeShown) {
      globalForQueue.backgroundQueueDisabledNoticeShown = true;
      logger.warn("Skipping BullMQ queue in local dev: Railway internal Redis hostname is not resolvable");
    }

    return null;
  }

  try {
    const parsed = new URL(redisUrl);

    return {
      host: parsed.hostname,
      port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      maxRetriesPerRequest: null,
      ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
    };
  } catch {
    logger.error("Invalid REDIS_URL for BullMQ queue connection");
    return null;
  }
}

function queueDefaults(): JobsOptions {
  return {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2_000,
    },
    removeOnComplete: {
      count: 500,
    },
    removeOnFail: {
      count: 500,
    },
  };
}

export function getBackgroundQueue() {
  const connection = redisConnectionFromEnv();
  if (!connection) {
    return null;
  }

  if (!globalForQueue.backgroundQueue) {
    globalForQueue.backgroundQueue = new Queue(BACKGROUND_QUEUE_NAME, {
      connection,
      defaultJobOptions: queueDefaults(),
    });
  }

  return globalForQueue.backgroundQueue;
}

type EnqueueResult = {
  queued: boolean;
  reason?: string;
  jobId?: string;
};

async function enqueueJob(name: BackgroundJobName, data: unknown, options?: JobsOptions): Promise<EnqueueResult> {
  const queue = getBackgroundQueue();
  if (!queue) {
    return {
      queued: false,
      reason: "queue_unavailable",
    };
  }

  const job = await queue.add(name, data, options);

  return {
    queued: true,
    jobId: job.id,
  };
}

export function backgroundQueueName() {
  return BACKGROUND_QUEUE_NAME;
}

export async function enqueueReminderDispatchJob(data: ReminderDispatchJobData) {
  const bucket = Math.floor(Date.now() / 60_000);

  return enqueueJob("dispatch-reminders", data, {
    jobId: `dispatch-reminders:${bucket}`,
  });
}

export async function enqueuePaymentsReconcileJob(data: PaymentsReconcileJobData = {}) {
  const bucket = Math.floor(Date.now() / 60_000);

  return enqueueJob("reconcile-payments", data, {
    jobId: `reconcile-payments:${bucket}`,
  });
}

export async function enqueueStripeWebhookProcessJob(data: StripeWebhookProcessJobData) {
  return enqueueJob("process-stripe-webhook", data, {
    jobId: `process-stripe-webhook:${data.stripeWebhookEventRecordId}`,
    attempts: 8,
    backoff: {
      type: "exponential",
      delay: 30_000,
    },
  });
}

export async function enqueueSmsRetryJob(data: SmsRetryJobData) {
  const delayMs = Math.min(5 * 60_000, Math.max(10_000, data.retryAttempt * 30_000));

  return enqueueJob("retry-sms", data, {
    jobId: `retry-sms:${data.jobId}:${data.templateKey}:${data.retryAttempt}`,
    delay: delayMs,
    attempts: 1,
  });
}
