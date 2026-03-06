import { NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api";
import { env } from "@/lib/env";
import { jsonData } from "@/lib/errors";
import { runPaymentsReconciliation } from "@/lib/payment-reconciliation";

function assertCronAuthorized(request: NextRequest) {
  if (!env.CRON_SECRET) {
    throw {
      status: 500,
      code: "CRON_SECRET_NOT_CONFIGURED",
      message: "CRON_SECRET must be configured for internal reconciliation",
    };
  }

  const provided = request.headers.get("x-cron-secret");
  if (!provided || provided !== env.CRON_SECRET) {
    throw {
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid cron secret",
    };
  }
}

async function handle(request: NextRequest) {
  return withApiErrorHandling(async () => {
    assertCronAuthorized(request);

    const webhookLimitRaw = request.nextUrl.searchParams.get("webhookLimit");
    const paymentLimitRaw = request.nextUrl.searchParams.get("paymentLimit");
    const webhookLimit = webhookLimitRaw ? Number.parseInt(webhookLimitRaw, 10) : undefined;
    const pendingPaymentLimit = paymentLimitRaw ? Number.parseInt(paymentLimitRaw, 10) : undefined;

    const result = await runPaymentsReconciliation({
      webhookLimit:
        typeof webhookLimit === "number" && Number.isFinite(webhookLimit) && webhookLimit > 0
          ? webhookLimit
          : undefined,
      pendingPaymentLimit:
        typeof pendingPaymentLimit === "number" &&
        Number.isFinite(pendingPaymentLimit) &&
        pendingPaymentLimit > 0
          ? pendingPaymentLimit
          : undefined,
    });

    return jsonData(result);
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
