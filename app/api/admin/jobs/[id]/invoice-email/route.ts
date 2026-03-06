import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { sendInvoiceEmailForJob } from "@/lib/email/invoice";
import { jsonData } from "@/lib/errors";
import { assertAdmin } from "@/lib/permissions";
import { adminInvoiceEmailSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);

    const { id } = await context.params;
    const body = await parseRequestBody(request, adminInvoiceEmailSchema);

    const result = await sendInvoiceEmailForJob({
      jobId: id,
      paymentId: body.paymentId,
      userId: user.id,
      source: "admin_resend",
    });

    return jsonData(result);
  });
}
