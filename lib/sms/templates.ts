import { SmsTemplateKey } from "@/lib/jobs";

export type SmsTemplateValues = {
  customerName: string;
  companyName: string;
  workerFirstName: string;
  addressShort: string;
  scheduledWindow: string;
  etaMinutes?: number;
  amountDue: string;
  confirmUrl?: string;
  rescheduleUrl?: string;
};

type TemplateFn = (values: SmsTemplateValues) => string;

const templates: Record<Exclude<SmsTemplateKey, "CUSTOM">, TemplateFn> = {
  ON_MY_WAY: (v) =>
    `${v.companyName}: ${v.workerFirstName} is on the way to ${v.addressShort}${
      v.etaMinutes ? ` (ETA ${v.etaMinutes} min)` : ""
    }.`,
  STARTED: (v) => `${v.companyName}: ${v.workerFirstName} has started your window service.`,
  FINISHED: (v) =>
    `${v.companyName}: Job finished at ${v.addressShort}. Amount due: ${v.amountDue}. Reply with questions.`,
  PAID: (v) =>
    `${v.companyName}: Payment received (${v.amountDue}). Thank you, ${v.customerName}!`,
  REMINDER_24H: (v) =>
    `${v.companyName}: Reminder for ${v.scheduledWindow} at ${v.addressShort}. Confirm: ${v.confirmUrl || "N/A"} Reschedule: ${v.rescheduleUrl || "N/A"}`,
  REMINDER_2H: (v) =>
    `${v.companyName}: Reminder, service starts around ${v.scheduledWindow}. Confirm: ${v.confirmUrl || "N/A"} Reschedule: ${v.rescheduleUrl || "N/A"}`,
  CONFIRMED: (v) =>
    `${v.companyName}: Thanks ${v.customerName}, your appointment is confirmed for ${v.scheduledWindow}.`,
};

export function renderTemplate(
  key: SmsTemplateKey,
  values: SmsTemplateValues,
  customBody?: string,
) {
  if (key === "CUSTOM") {
    return customBody?.trim() || "";
  }

  return templates[key](values);
}
