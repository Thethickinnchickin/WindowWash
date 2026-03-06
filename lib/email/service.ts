import nodemailer from "nodemailer";
import { env, hasEmailConfig } from "@/lib/env";
import { logger } from "@/lib/logger";

type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

const globalForEmail = globalThis as typeof globalThis & {
  mailTransport?: nodemailer.Transporter;
};

function smtpPort() {
  const parsed = Number.parseInt(env.SMTP_PORT || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 587;
  }
  return parsed;
}

function getTransporter() {
  if (!hasEmailConfig()) {
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

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}) {
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
