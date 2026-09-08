import { addHours } from "date-fns";
import { JobStatus } from "@prisma/client";
import { createAppointmentActionToken } from "@/lib/appointment-action-links";
import { createJobEvent } from "@/lib/events";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/service";

export type AppointmentEmailTemplateKey =
  | "APPOINTMENT_SCHEDULED"
  | "APPOINTMENT_DAY_OF_REMINDER";

type AppointmentEmailJob = {
  id: string;
  customerId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: JobStatus;
  amountDueCents: number;
  street: string;
  city: string;
  state: string;
  zip: string;
  customer: {
    name: string;
    email: string | null;
  };
  assignedWorker?: {
    name: string;
  } | null;
};

type AppointmentEmailEvent = {
  type: string;
  metadata: unknown;
};

const SENDABLE_STATUSES: JobStatus[] = ["scheduled", "on_my_way"];
const BUSINESS_TIME_ZONE = "America/Los_Angeles";

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function currency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatAppointmentWindow(start: Date, end: Date) {
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(start);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  });

  return `${date}, ${time.format(start)} - ${time.format(end)}`;
}

function supportLine() {
  const contacts = [env.COMPANY_CONTACT_EMAIL, env.COMPANY_CONTACT_PHONE].filter(Boolean);
  return contacts.length > 0 ? `Questions? Contact ${contacts.join(" or ")}.` : "";
}

function buildEmailContent(input: {
  job: AppointmentEmailJob;
  templateKey: AppointmentEmailTemplateKey;
  confirmUrl: string;
  portalUrl: string;
}) {
  const { job, templateKey, confirmUrl, portalUrl } = input;
  const companyName = env.COMPANY_NAME;
  const appointmentWindow = formatAppointmentWindow(job.scheduledStart, job.scheduledEnd);
  const address = `${job.street}, ${job.city}, ${job.state} ${job.zip}`;
  const worker = job.assignedWorker?.name ? `Assigned worker: ${job.assignedWorker.name}.` : "";
  const estimate =
    job.amountDueCents > 0
      ? `Estimated total: ${currency(job.amountDueCents)}. This is based on an estimated $20 per window and may change after review or completion. Payment is collected after the job is complete.`
      : "Payment is collected after the job is complete.";
  const line = supportLine();
  const subject =
    templateKey === "APPOINTMENT_DAY_OF_REMINDER"
      ? `${companyName} reminder: service today`
      : `${companyName} appointment scheduled`;
  const intro =
    templateKey === "APPOINTMENT_DAY_OF_REMINDER"
      ? `This is a reminder that your ${companyName} appointment is today.`
      : `Your ${companyName} appointment has been scheduled.`;

  const text = [
    `Hi ${job.customer.name},`,
    "",
    intro,
    "",
    `When: ${appointmentWindow}`,
    `Address: ${address}`,
    worker,
    estimate,
    "",
    `Confirm your appointment: ${confirmUrl}`,
    `Manage your appointment: ${portalUrl}`,
    "",
    line,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <p>Hi ${escapeHtml(job.customer.name)},</p>
      <p>${escapeHtml(intro)}</p>
      <p>
        <strong>When:</strong> ${escapeHtml(appointmentWindow)}<br />
        <strong>Address:</strong> ${escapeHtml(address)}<br />
        ${worker ? `<strong>${escapeHtml(worker)}</strong><br />` : ""}
        ${escapeHtml(estimate)}
      </p>
      <p>
        <a href="${escapeHtml(confirmUrl)}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 12px 16px; text-decoration: none; border-radius: 6px;">Confirm appointment</a>
      </p>
      <p><a href="${escapeHtml(portalUrl)}">Manage your appointment</a></p>
      ${line ? `<p>${escapeHtml(line)}</p>` : ""}
    </div>
  `;

  return {
    subject,
    text,
    html,
  };
}

async function createEmailEvent(input: {
  jobId: string;
  userId?: string;
  templateKey: AppointmentEmailTemplateKey;
  emailTo: string;
  status: "sent" | "mock_sent" | "failed";
  providerMessageId?: string | null;
  error?: string;
}) {
  await createJobEvent({
    jobId: input.jobId,
    userId: input.userId,
    type: "MESSAGE_SENT",
    metadata: {
      channel: "email",
      templateKey: input.templateKey,
      emailTo: input.emailTo,
      status: input.status,
      providerMessageId: input.providerMessageId || null,
      ...(input.error ? { error: input.error } : {}),
    },
  });
}

export function hasSuccessfulAppointmentEmailEvent(input: {
  events: AppointmentEmailEvent[];
  templateKey: AppointmentEmailTemplateKey;
}) {
  return input.events.some((event) => {
    if (event.type !== "MESSAGE_SENT") {
      return false;
    }

    const metadata = asRecord(event.metadata);
    return (
      metadata?.channel === "email" &&
      metadata.templateKey === input.templateKey &&
      ["sent", "mock_sent"].includes(String(metadata.status))
    );
  });
}

export async function sendAppointmentEmail(input: {
  job: AppointmentEmailJob;
  templateKey: AppointmentEmailTemplateKey;
  baseUrl: string;
  userId?: string;
}) {
  const { job, templateKey, userId } = input;

  if (!job.customer.email) {
    return {
      status: "skipped" as const,
      reason: "customer_email_required",
    };
  }

  if (!SENDABLE_STATUSES.includes(job.status)) {
    return {
      status: "skipped" as const,
      reason: "job_status_not_sendable",
    };
  }

  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const token = await createAppointmentActionToken({
    jobId: job.id,
    action: "confirm",
    expiresAt: addHours(job.scheduledStart, 6),
  });
  const confirmUrl = `${baseUrl}/customer/confirm/${job.id}?token=${encodeURIComponent(token)}`;
  const portalUrl = `${baseUrl}/customer/portal`;
  const content = buildEmailContent({
    job,
    templateKey,
    confirmUrl,
    portalUrl,
  });

  try {
    const result = await sendEmail({
      to: job.customer.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });

    await createEmailEvent({
      jobId: job.id,
      userId,
      templateKey,
      emailTo: job.customer.email,
      status: result.status,
      providerMessageId: result.providerMessageId,
    });

    return {
      status: result.status,
      providerMessageId: result.providerMessageId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await createEmailEvent({
      jobId: job.id,
      userId,
      templateKey,
      emailTo: job.customer.email,
      status: "failed",
      error: message,
    });

    throw error;
  }
}

export async function sendAppointmentEmailBestEffort(input: {
  job: AppointmentEmailJob;
  templateKey: AppointmentEmailTemplateKey;
  baseUrl: string;
  userId?: string;
}) {
  try {
    return await sendAppointmentEmail(input);
  } catch (error) {
    logger.warn("Appointment email send failed", {
      jobId: input.job.id,
      templateKey: input.templateKey,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      status: "failed" as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function sendAppointmentEmailBestEffortForJob(input: {
  jobId: string;
  templateKey: AppointmentEmailTemplateKey;
  baseUrl: string;
  userId?: string;
}) {
  const job = await prisma.job.findUnique({
    where: {
      id: input.jobId,
    },
    include: {
      customer: {
        select: {
          name: true,
          email: true,
        },
      },
      assignedWorker: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!job) {
    return {
      status: "skipped" as const,
      reason: "job_not_found",
    };
  }

  return sendAppointmentEmailBestEffort({
    job,
    templateKey: input.templateKey,
    baseUrl: input.baseUrl,
    userId: input.userId,
  });
}
