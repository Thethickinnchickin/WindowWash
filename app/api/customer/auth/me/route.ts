import { withApiErrorHandling } from "@/lib/api";
import { getCustomerSessionAccount } from "@/lib/customer-auth";
import { jsonData } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrorHandling(async () => {
    const account = await getCustomerSessionAccount();

    if (!account) {
      return jsonData({ account: null });
    }

    return jsonData({
      account: {
        id: account.id,
        email: account.email,
        customerId: account.customerId,
        customer: account.customer,
      },
    });
  });
}
