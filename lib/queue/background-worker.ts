import { Job, Worker } from "bullmq";
import { logger } from "@/lib/logger";
import { runPaymentsReconciliation } from "@/lib/payment-reconciliation";
import { prisma } from "@/lib/prisma";
import { runAppointmentReminderDispatch } from "@/lib/job-reminders";
import type { SmsTemplateValues } from "@/lib/sms/templates";
import { sendSmsForJob } from "@/lib/sms/service";
import { requireStripe } from "@/lib/stripe";
import { processStripeWebhookEventById } from "@/lib/stripe-webhook-queue";
import {
  type BackgroundJobName,
  ReminderDispatchJobData,
  PaymentsReconcileJobData,
  StripeWebhookProcessJobData,
  SmsRetryJobData,
  backgroundQueueName,
  getBackgroundQueue,
} from "@/lib/queue/background-queue";

function queueConnection() {
  const queue = getBackgroundQueue();
  if (!queue) {
    return null;
  }

  return queue.opts.connection;
}

async function loadJobForSmsRetry(jobId: string) {
  return prisma.job.findUnique({
    where: {
      id: jobId,
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phoneE164: true,
          smsOptOut: true,
        },
      },
      assignedWorker: {
        select: {
          name: true,
        },
      },
    },
  });
}

async function processBackgroundJob(job: Job) {
  if (job.name === "dispatch-reminders") {
    const data = job.data as ReminderDispatchJobData;
    return runAppointmentReminderDispatch({
      baseUrl: data.baseUrl,
    });
  }

  if (job.name === "reconcile-payments") {
    const data = job.data as PaymentsReconcileJobData;
    return runPaymentsReconciliation(data);
  }

  if (job.name === "process-stripe-webhook") {
    const data = job.data as StripeWebhookProcessJobData;
    const stripe = requireStripe();

    return processStripeWebhookEventById({
      eventId: data.stripeWebhookEventRecordId,
      stripe,
    });
  }

  if (job.name === "retry-sms") {
    const data = job.data as SmsRetryJobData;
    const smsJob = await loadJobForSmsRetry(data.jobId);

    if (!smsJob) {
      return {
        processed: false,
        reason: "job_not_found",
      };
    }

    return sendSmsForJob({
      job: smsJob,
      templateKey: data.templateKey,
      userId: data.userId,
      etaMinutes: data.etaMinutes,
      customText: data.customText,
      templateValues: data.templateValues as Partial<SmsTemplateValues> | undefined,
      retryAttempt: data.retryAttempt,
    });
  }

  logger.warn("Received unknown background job", {
    name: job.name,
  });

  return {
    processed: false,
    reason: "unknown_job",
  };
}

export async function startBackgroundWorker() {
  const connection = queueConnection();
  if (!connection) {
    logger.warn("Background queue worker not started: Redis queue unavailable");
    return null;
  }

  const worker = new Worker(backgroundQueueName(), processBackgroundJob, {
    connection,
    concurrency: 4,
  });

  worker.on("completed", (job) => {
    logger.info("Background job completed", {
      id: job.id,
      name: job.name as BackgroundJobName,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error("Background job failed", {
      id: job?.id,
      name: job?.name,
      error: error.message,
    });
  });

  await worker.waitUntilReady();
  logger.info("Background worker ready", {
    queue: backgroundQueueName(),
  });

  return worker;
}
