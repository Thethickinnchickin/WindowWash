import { JobStatus } from "@prisma/client";
import { HttpError } from "@/lib/errors";

const DEFAULT_RESCHEDULE_CUTOFF_HOURS = 12;
const DEFAULT_CANCEL_CUTOFF_HOURS = 12;

function readPositiveHours(envValue: string | undefined, fallback: number) {
  if (!envValue) {
    return fallback;
  }

  const parsed = Number.parseInt(envValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export function getCustomerRescheduleCutoffHours() {
  return readPositiveHours(process.env.CUSTOMER_RESCHEDULE_MIN_HOURS, DEFAULT_RESCHEDULE_CUTOFF_HOURS);
}

export function getCustomerCancelCutoffHours() {
  return readPositiveHours(process.env.CUSTOMER_CANCEL_MIN_HOURS, DEFAULT_CANCEL_CUTOFF_HOURS);
}

export function assertCustomerCanReschedule(params: {
  status: JobStatus;
  scheduledStart: Date;
}) {
  if (!["scheduled", "on_my_way"].includes(params.status)) {
    throw new HttpError(
      400,
      "RESCHEDULE_NOT_ALLOWED",
      "This appointment can no longer be rescheduled from the customer portal",
    );
  }

  const cutoffHours = getCustomerRescheduleCutoffHours();
  const cutoffTime = params.scheduledStart.getTime() - cutoffHours * 60 * 60 * 1000;
  if (Date.now() > cutoffTime) {
    throw new HttpError(
      400,
      "RESCHEDULE_WINDOW_CLOSED",
      `Reschedule is only allowed at least ${cutoffHours} hour(s) before start time`,
    );
  }
}

export function assertCustomerCanCancel(params: {
  status: JobStatus;
  scheduledStart: Date;
}) {
  if (!["scheduled", "on_my_way"].includes(params.status)) {
    throw new HttpError(
      400,
      "CANCEL_NOT_ALLOWED",
      "This appointment can no longer be canceled from the customer portal",
    );
  }

  const cutoffHours = getCustomerCancelCutoffHours();
  const cutoffTime = params.scheduledStart.getTime() - cutoffHours * 60 * 60 * 1000;
  if (Date.now() > cutoffTime) {
    throw new HttpError(
      400,
      "CANCEL_WINDOW_CLOSED",
      `Cancel is only allowed at least ${cutoffHours} hour(s) before start time`,
    );
  }
}
