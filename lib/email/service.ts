import nodemailer from "nodemailer";
import { env, hasResendEmailConfig, hasSmtpEmailConfig } from "@/lib/env";
import { logger } from "@/lib/logger";

type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

const globalForEmail = globalThis as typeof globalThis & {
  mailTransport?: nodemailer.Transporter;
};

type ResendEmailPayload = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  reply_to?: string;
  attachments?: {
    filename: string;
    content: string;
  }[];
};

type ResendEmailResponse = {
  id?: string;
  name?: string;
  message?: string;
  error?: {
    name?: string;
    message?: string;
  };
};

function smtpPort() {
  const parsed = Number.parseInt(env.SMTP_PORT || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 587;
  }
  return parsed;
}

function getTransporter() {
  if (!hasSmtpEmailConfig()) {
    return null;
  }

  if (!globalForEmail.mailTransport) {
    globalForEmail.mailTransport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: smtpPort(),
      secure: smtpPort() === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return globalForEmail.mailTransport;
}

async function parseResendResponse(response: Response): Promise<ResendEmailResponse> {
  try {
    return (await response.json()) as ResendEmailResponse;
  } catch {
    return {};
  }
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}) {
  const payload: ResendEmailPayload = {
    from: env.EMAIL_FROM!,
    to: [params.to],
    subject: params.subject,
    text: params.text,
    ...(params.html ? { html: params.html } : {}),
    ...(env.COMPANY_CONTACT_EMAIL ? { reply_to: env.COMPANY_CONTACT_EMAIL } : {}),
    ...(params.attachments?.length
      ? {
          attachments: params.attachments.map((item) => ({
            filename: item.filename,
            content: item.content.toString("base64"),
          })),
        }
      : {}),
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await parseResendResponse(response);

  if (!response.ok) {
    const message = result.error?.message || result.message || response.statusText;
    throw new Error(`Resend email send failed (${response.status}): ${message}`);
  }

  return {
    status: "sent" as const,
    providerMessageId: result.id || null,
  };
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}) {
  if (hasResendEmailConfig()) {
    return sendViaResend(params);
  }

  const transporter = getTransporter();

  if (!transporter || !env.EMAIL_FROM) {
    logger.info("Email mock send", {
      to: params.to,
      subject: params.subject,
      attachmentCount: params.attachments?.length || 0,
    });

    return {
      status: "mock_sent" as const,
      providerMessageId: null,
    };
  }

  const result = await transporter.sendMail({
    from: env.EMAIL_FROM,
    ...(env.COMPANY_CONTACT_EMAIL ? { replyTo: env.COMPANY_CONTACT_EMAIL } : {}),
    to: params.to,
    subject: params.subject,
    text: params.text,
    ...(params.html ? { html: params.html } : {}),
    attachments: params.attachments?.map((item) => ({
      filename: item.filename,
      content: item.content,
      ...(item.contentType ? { contentType: item.contentType } : {}),
    })),
  });

  return {
    status: "sent" as const,
    providerMessageId: result.messageId || null,
  };
}
