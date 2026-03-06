import PDFDocument from "pdfkit";

type InvoicePayment = {
  id: string;
  method: string;
  status: string;
  amountCents: number;
  createdAt: Date;
};

type InvoiceDocumentInput = {
  invoiceNumber: string;
  companyName: string;
  customerName: string;
  customerEmail: string | null;
  jobId: string;
  address: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  amountDueCents: number;
  payments: InvoicePayment[];
};

function currency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function renderInvoicePdfBuffer(input: InvoiceDocumentInput) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: 50,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text(input.companyName);
    doc.moveDown(0.5);
    doc.fontSize(12).text("Service Invoice / Receipt");
    doc.moveDown();

    doc.fontSize(10).text(`Invoice #: ${input.invoiceNumber}`);
    doc.text(`Job ID: ${input.jobId}`);
    doc.text(`Date: ${new Date().toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(12).text("Bill To", { underline: true });
    doc.fontSize(10).text(input.customerName);
    if (input.customerEmail) {
      doc.text(input.customerEmail);
    }
    doc.moveDown();

    doc.fontSize(12).text("Service Details", { underline: true });
    doc.fontSize(10).text(`Address: ${input.address}`);
    doc.text(`Scheduled: ${input.scheduledStart.toLocaleString()} - ${input.scheduledEnd.toLocaleTimeString()}`);
    doc.text(`Amount Due: ${currency(input.amountDueCents)}`);
    doc.moveDown();

    doc.fontSize(12).text("Payments", { underline: true });
    doc.moveDown(0.5);

    if (!input.payments.length) {
      doc.fontSize(10).text("No payments recorded.");
    } else {
      for (const payment of input.payments) {
        doc
          .fontSize(10)
          .text(
            `${payment.createdAt.toLocaleString()} | ${payment.method.toUpperCase()} | ${payment.status.toUpperCase()} | ${currency(payment.amountCents)}`,
          );
      }
    }

    const paidCents = input.payments
      .filter((payment) => payment.status === "succeeded")
      .reduce((sum, payment) => sum + payment.amountCents, 0);
    const remainingCents = Math.max(input.amountDueCents - paidCents, 0);

    doc.moveDown();
    doc.fontSize(12).text("Summary", { underline: true });
    doc.fontSize(10).text(`Paid: ${currency(paidCents)}`);
    doc.text(`Remaining: ${currency(remainingCents)}`);

    doc.moveDown(2);
    doc.fontSize(9).fillColor("#475569").text("Thank you for your business.");

    doc.end();
  });
}
