import { withApiErrorHandling } from "@/lib/api";
import { clearCustomerSessionCookie } from "@/lib/customer-auth";
import { jsonData } from "@/lib/errors";

export async function POST() {
  return withApiErrorHandling(async () => {
    await clearCustomerSessionCookie();
    return jsonData({ ok: true });
  });
}
