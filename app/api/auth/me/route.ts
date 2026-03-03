import { withApiErrorHandling } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { jsonData } from "@/lib/errors";

export async function GET() {
  return withApiErrorHandling(async () => {
    const user = await getSessionUser();

    if (!user) {
      return jsonData({ user: null });
    }

    return jsonData({ user });
  });
}
