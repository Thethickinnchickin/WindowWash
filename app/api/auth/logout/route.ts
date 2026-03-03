import { withApiErrorHandling } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth";
import { jsonData } from "@/lib/errors";

export async function POST() {
  return withApiErrorHandling(async () => {
    await clearSessionCookie();
    return jsonData({ ok: true });
  });
}
