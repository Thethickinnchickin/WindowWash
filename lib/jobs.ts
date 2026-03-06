import { JobStatus } from "@prisma/client";

export const WORKER_STATUS_FLOW: JobStatus[] = [
  "scheduled",
  "on_my_way",
  "in_progress",
  "finished",
  "paid",
];

export const WORKER_ALLOWED_NEXT = new Map<JobStatus, JobStatus[]>([
  ["scheduled", ["on_my_way"]],
  ["on_my_way", ["in_progress"]],
  ["in_progress", ["finished"]],
  ["finished", ["paid"]],
  ["paid", []],
  ["canceled", []],
  ["needs_attention", []],
]);

export const STATUS_TO_SMS_TEMPLATE: Partial<Record<JobStatus, SmsTemplateKey>> = {
  on_my_way: "ON_MY_WAY",
  in_progress: "STARTED",
  finished: "FINISHED",
  paid: "PAID",
};

export type SmsTemplateKey =
  | "ON_MY_WAY"
  | "STARTED"
  | "FINISHED"
  | "PAID"
  | "REMINDER_24H"
  | "REMINDER_2H"
  | "CONFIRMED"
  | "CUSTOM";

export function canWorkerTransitionStatus(from: JobStatus, to: JobStatus) {
  const allowed = WORKER_ALLOWED_NEXT.get(from) ?? [];
  return allowed.includes(to);
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatScheduleWindow(start: Date, end: Date) {
  return `${start.toLocaleDateString()} ${start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function buildMapsLink(address: {
  street: string;
  city: string;
  state: string;
  zip: string;
}) {
  const query = encodeURIComponent(
    `${address.street}, ${address.city}, ${address.state} ${address.zip}`,
  );

  return `https://maps.apple.com/?q=${query}`;
}
