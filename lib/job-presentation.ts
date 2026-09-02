import type { SessionUser } from "@/lib/auth";
import { canViewJobPaymentInfo } from "@/lib/permissions";

type JsonRecord = Record<string, unknown>;

type JobResponseShape = JsonRecord & {
  status?: string;
  amountDueCents?: unknown;
  customer?: unknown;
  payments?: unknown;
  events?: unknown;
  smsLogs?: unknown;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function pickDefined(source: JsonRecord, keys: string[]) {
  const output: JsonRecord = {};

  for (const key of keys) {
    if (key in source) {
      output[key] = source[key];
    }
  }

  return output;
}

function sanitizePaymentMethod(value: unknown) {
  const method = asRecord(value);

  if (!method) {
    return value;
  }

  return pickDefined(method, ["id", "brand", "last4", "expMonth", "expYear", "isDefault"]);
}

function sanitizePayment(value: unknown) {
  const payment = asRecord(value);

  if (!payment) {
    return value;
  }

  return pickDefined(payment, [
    "id",
    "status",
    "method",
    "paymentType",
    "amountCents",
    "refundedAmountCents",
    "cardBrand",
    "cardLast4",
    "createdAt",
  ]);
}

function isPaymentMetadataKey(key: string) {
  const normalized = key.toLowerCase();

  return (
    normalized.includes("amount") ||
    normalized.includes("deposit") ||
    normalized.includes("fee") ||
    normalized.includes("paid") ||
    normalized.includes("payment") ||
    normalized.includes("prepay") ||
    normalized.includes("price") ||
    normalized.includes("pricing") ||
    normalized.includes("refund") ||
    normalized.includes("remainingdue") ||
    normalized.includes("stripe")
  );
}

function sanitizeEventMetadata(value: unknown, includePaymentInfo: boolean): unknown {
  if (includePaymentInfo) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeEventMetadata(item, includePaymentInfo));
  }

  const record = asRecord(value);

  if (!record) {
    return value;
  }

  const output: JsonRecord = {};

  for (const [key, nestedValue] of Object.entries(record)) {
    if (!isPaymentMetadataKey(key)) {
      output[key] = sanitizeEventMetadata(nestedValue, includePaymentInfo);
    }
  }

  return output;
}

function sanitizeCustomer(value: unknown, includePaymentMethods: boolean) {
  const customer = asRecord(value);

  if (!customer) {
    return value;
  }

  return {
    ...pickDefined(customer, ["id", "name", "phoneE164", "email", "smsOptOut"]),
    paymentMethods:
      includePaymentMethods && Array.isArray(customer.paymentMethods)
        ? customer.paymentMethods.map(sanitizePaymentMethod)
        : [],
  };
}

function sanitizeEvents(value: unknown, includePaymentInfo: boolean) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value
    .filter((event) => {
      const record = asRecord(event);
      return includePaymentInfo || record?.type !== "PAYMENT_RECORDED";
    })
    .map((event) => {
      const record = asRecord(event);

      if (!record) {
        return event;
      }

      return {
        ...record,
        metadata: sanitizeEventMetadata(record.metadata, includePaymentInfo),
      };
    });
}

function sanitizeSmsLogs(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((sms) => {
    const record = asRecord(sms);

    if (!record) {
      return sms;
    }

    return pickDefined(record, ["id", "templateKey", "status", "error", "createdAt"]);
  });
}

export function serializeJobForUser<TJob extends JobResponseShape>(
  job: TJob,
  user: SessionUser,
) {
  const paymentInfoAvailable = canViewJobPaymentInfo(user, job.status || "");

  return {
    ...job,
    paymentInfoAvailable,
    amountDueCents: paymentInfoAvailable ? job.amountDueCents : null,
    customer: sanitizeCustomer(job.customer, paymentInfoAvailable),
    payments:
      paymentInfoAvailable && Array.isArray(job.payments)
        ? job.payments.map(sanitizePayment)
        : Array.isArray(job.payments)
          ? []
          : job.payments,
    events: sanitizeEvents(job.events, paymentInfoAvailable),
    smsLogs: sanitizeSmsLogs(job.smsLogs),
  };
}

export function serializeJobsForUser<TJob extends JobResponseShape>(
  jobs: TJob[],
  user: SessionUser,
) {
  return jobs.map((job) => serializeJobForUser(job, user));
}
