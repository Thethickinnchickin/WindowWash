import { withApiErrorHandling } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { jsonData } from "@/lib/errors";
import { findJobWithDetailsForUser } from "@/lib/job-access";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    const { id } = await context.params;

    const job = await findJobWithDetailsForUser(id, user);

    return jsonData({ job });
  });
}
