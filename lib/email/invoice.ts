import { createJobEvent } from "@/lib/events";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { renderInvoicePdfBuffer } from "@/lib/email/invoice-pdf";
import { sendEmail } from "@/lib/email/service";
import { env } from "@/lib/env";

export async function sendInvoiceEmailForJob(params: {
  jobId: string;
  paymentId?: string;
  userId?: string;
  source: "auto_payment" | "admin_resend";
}) {
  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      payments: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!job) {
    throw {
      status: 404,
      code: "NOT_FOUND",
      message: "Job not found",
    };
  }

  if (!job.customer.email) {
    throw {
      status: 400,
      code: "CUSTOMER_EMAIL_REQUIRED",
      message: "Customer does not have an email address",
    };
  }

  const payments = params.paymentId
    ? job.payments.filter((payment) => payment.id === params.paymentId)
    : job.payments;

  if (params.paymentId && payments.length === 0) {
    throw {
      status: 404,
      code: "PAYMENT_NOT_FOUND",
      message: "Payment not found for this job",
    };
  }

  const invoiceNumber = `${job.id.slice(-8).toUpperCase()}-${Date.now().toString().slice(-6)}`;

  const pdfBuffer = await renderInvoicePdfBuffer({
    invoiceNumber,
    companyName: env.COMPANY_NAME,
    customerName: job.customer.name,
    customerEmail: job.customer.email,
    jobId: job.id,
    address: `${job.street}, ${job.city}, ${job.state} ${job.zip}`,
    scheduledStart: job.scheduledStart,
    scheduledEnd: job.scheduledEnd,
    amountDueCents: job.amountDueCents,
    payments: payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      status: payment.status,
      amountCents: payment.amountCents,
      createdAt: payment.createdAt,
    })),
  });

  const result = await sendEmail({
    to: job.customer.email,
    subject: `${env.COMPANY_NAME} Invoice #${invoiceNumber}`,
    text: `Hi ${job.customer.name}, your invoice/receipt is attached as a PDF.`,
    attachments: [
      {
        filename: `invoice-${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  await createJobEvent({
    jobId: job.id,
    userId: params.userId,
    type: "NOTE_ADDED",
    metadata: {
      text: "Invoice email sent",
      source: params.source,
      invoiceNumber,
      emailTo: job.customer.email,
      status: result.status,
      providerMessageId: result.providerMessageId,
      paymentId: params.paymentId || null,
    },
  });

  return {
    status: result.status,
    invoiceNumber,
    emailTo: job.customer.email,
  };
}

export async function sendInvoiceEmailBestEffort(params: {
  jobId: string;
  paymentId?: string;
  userId?: string;
  source: "auto_payment" | "admin_resend";
}) {
  try {
    return await sendInvoiceEmailForJob(params);
  } catch (error) {
    logger.warn("Invoice email send failed", {
      jobId: params.jobId,
      paymentId: params.paymentId,
      source: params.source,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      status: "failed" as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
