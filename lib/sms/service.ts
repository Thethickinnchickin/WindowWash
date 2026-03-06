import twilio from "twilio";
import { Job, JobStatus, SmsStatus } from "@prisma/client";
import { env, hasTwilioConfig } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { SmsTemplateValues, renderTemplate } from "@/lib/sms/templates";
import { SmsTemplateKey } from "@/lib/jobs";

const STATUS_SMS_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_SMS_RETRY_ATTEMPTS = 3;
const statusRateLimiter = new Map<string, number>();

const twilioClient = hasTwilioConfig()
  ? twilio(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!)
  : null;

function isRateLimited(jobId: string, key: SmsTemplateKey) {
  if (key !== "ON_MY_WAY") {
    return false;
  }

  const mapKey = `${jobId}:${key}`;
  const now = Date.now();
  const previous = statusRateLimiter.get(mapKey);

  if (previous && now - previous < STATUS_SMS_COOLDOWN_MS) {
    return true;
  }

  statusRateLimiter.set(mapKey, now);
  return false;
}

export function buildTemplateValues(input: {
  customerName: string;
  workerName?: string | null;
  street: string;
  city: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  etaMinutes?: number;
  amountDueCents: number;
}): SmsTemplateValues {
  const workerFirstName = input.workerName?.split(" ")[0] ?? "Our tech";
  const scheduledWindow = `${input.scheduledStart.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}-${input.scheduledEnd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return {
    customerName: input.customerName,
    companyName: env.COMPANY_NAME,
    workerFirstName,
    addressShort: `${input.street}, ${input.city}`,
    scheduledWindow,
    etaMinutes: input.etaMinutes,
    amountDue: new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(input.amountDueCents / 100),
  };
}

export async function sendSmsForJob(input: {
  job: Pick<
    Job,
    "id" | "customerId" | "street" | "city" | "scheduledStart" | "scheduledEnd" | "amountDueCents"
  > & {
    customer: {
      name: string;
      phoneE164: string;
      smsOptOut: boolean;
    };
    assignedWorker?: {
      name: string;
    } | null;
  };
  templateKey: SmsTemplateKey;
  userId?: string;
  etaMinutes?: number;
  customText?: string;
  templateValues?: Partial<SmsTemplateValues>;
  retryAttempt?: number;
  skipEnqueueRetry?: boolean;
}) {
  const { job, templateKey } = input;
  const values = {
    ...buildTemplateValues({
      customerName: job.customer.name,
      workerName: job.assignedWorker?.name,
      street: job.street,
      city: job.city,
      scheduledStart: job.scheduledStart,
      scheduledEnd: job.scheduledEnd,
      etaMinutes: input.etaMinutes,
      amountDueCents: job.amountDueCents,
    }),
    ...(input.templateValues || {}),
  };

  const body = renderTemplate(templateKey, values, input.customText);

  if (!body) {
    return { skipped: true, reason: "empty_body" };
  }

  let status: SmsStatus = "queued";
  let providerMessageId: string | undefined;
  let error: string | undefined;

  if (job.customer.smsOptOut) {
    status = "failed";
    error = "sms_opt_out";
  } else if (isRateLimited(job.id, templateKey)) {
    status = "failed";
    error = "rate_limited";
  } else if (!twilioClient) {
    status = "mock_sent";
    logger.info("SMS mock send", {
      to: job.customer.phoneE164,
      body,
      templateKey,
      jobId: job.id,
    });
  } else {
    try {
      const result = await twilioClient.messages.create({
        from: env.TWILIO_FROM_NUMBER!,
        to: job.customer.phoneE164,
        body,
      });
      status = "sent";
      providerMessageId = result.sid;
    } catch (smsError) {
      status = "failed";
      error = smsError instanceof Error ? smsError.message : "unknown_sms_error";
    }
  }

  const smsLog = await prisma.smsLog.create({
    data: {
      jobId: job.id,
      customerId: job.customerId,
      toPhoneE164: job.customer.phoneE164,
      templateKey,
      body,
      providerMessageId,
      status,
      error,
    },
  });

  await prisma.jobEvent.create({
    data: {
      jobId: job.id,
      userId: input.userId,
      type: "SMS_SENT",
      metadata: {
        templateKey,
        status,
        smsLogId: smsLog.id,
        ...(error ? { error } : {}),
      },
    },
  });

  const retryAttempt = input.retryAttempt ?? 0;
  const canRetry =
    status === "failed" &&
    !input.skipEnqueueRetry &&
    retryAttempt < MAX_SMS_RETRY_ATTEMPTS &&
    error !== "sms_opt_out" &&
    error !== "rate_limited";

  if (canRetry) {
    try {
      const { enqueueSmsRetryJob } = await import("@/lib/queue/background-queue");
      await enqueueSmsRetryJob({
        jobId: job.id,
        templateKey,
        userId: input.userId,
        etaMinutes: input.etaMinutes,
        customText: input.customText,
        templateValues: input.templateValues,
        retryAttempt: retryAttempt + 1,
      });
    } catch (retryError) {
      logger.warn("Failed to enqueue SMS retry", {
        jobId: job.id,
        templateKey,
        retryAttempt: retryAttempt + 1,
        error: retryError instanceof Error ? retryError.message : String(retryError),
      });
    }
  }

  return { status, providerMessageId, error, smsLogId: smsLog.id };
}

export function templateKeyForStatus(status: JobStatus): SmsTemplateKey | null {
  if (status === "on_my_way") {
    return "ON_MY_WAY";
  }

  if (status === "in_progress") {
    return "STARTED";
  }

  if (status === "finished") {
    return "FINISHED";
  }

  if (status === "paid") {
    return "PAID";
  }

  return null;
}
