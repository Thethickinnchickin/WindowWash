import { SmsTemplateKey } from "@/lib/jobs";

export type SmsTemplateValues = {
  customerName: string;
  companyName: string;
  workerFirstName: string;
  addressShort: string;
  scheduledWindow: string;
  etaMinutes?: number;
  amountDue: string;
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
