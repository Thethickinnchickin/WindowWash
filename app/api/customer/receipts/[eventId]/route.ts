import { requireCustomerSessionAccount } from "@/lib/customer-auth";
import { renderInvoicePdfBuffer } from "@/lib/email/invoice-pdf";
import { env } from "@/lib/env";
import { HttpError, jsonError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

function metadataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function pdfResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  try {
    const account = await requireCustomerSessionAccount();
    const { eventId } = await context.params;

    const event = await prisma.jobEvent.findUnique({
      where: {
        id: eventId,
      },
      include: {
        job: {
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
        },
      },
    });

    if (!event || event.job.customerId !== account.customerId) {
      throw new HttpError(404, "NOT_FOUND", "Receipt not found");
    }

    const metadata = metadataRecord(event.metadata);
    const invoiceNumber = typeof metadata.invoiceNumber === "string" ? metadata.invoiceNumber : null;
    const paymentId = typeof metadata.paymentId === "string" ? metadata.paymentId : null;

    if (!invoiceNumber) {
      throw new HttpError(404, "NOT_FOUND", "Receipt not found");
    }

    const payments = paymentId
      ? event.job.payments.filter((payment) => payment.id === paymentId)
      : event.job.payments;

    const pdfBuffer = await renderInvoicePdfBuffer({
      invoiceNumber,
      companyName: env.COMPANY_NAME,
      companyContactEmail: env.COMPANY_CONTACT_EMAIL,
      companyContactPhone: env.COMPANY_CONTACT_PHONE,
      customerName: event.job.customer.name,
      customerEmail: event.job.customer.email,
      jobId: event.job.id,
      address: `${event.job.street}, ${event.job.city}, ${event.job.state} ${event.job.zip}`,
      scheduledStart: event.job.scheduledStart,
      scheduledEnd: event.job.scheduledEnd,
      amountDueCents: event.job.amountDueCents,
      payments: payments.map((payment) => ({
        id: payment.id,
        method: payment.method,
        status: payment.status,
        amountCents: payment.amountCents,
        createdAt: payment.createdAt,
      })),
    });

    return pdfResponse(pdfBuffer, `receipt-${invoiceNumber}.pdf`);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonError(error.status, error.code, error.message, error.details);
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      "code" in error &&
      "message" in error
    ) {
      const typed = error as {
        status: number;
        code: string;
        message: string;
        details?: unknown;
      };

      return jsonError(typed.status, typed.code, typed.message, typed.details);
    }

    return jsonError(500, "INTERNAL_SERVER_ERROR", "Unexpected server error");
  }
}
