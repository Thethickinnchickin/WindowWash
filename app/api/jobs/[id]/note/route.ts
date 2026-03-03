import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { withIdempotency } from "@/lib/idempotency";
import { findJobForUser } from "@/lib/job-access";
import { noteSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    const { id: jobId } = await context.params;
    const body = await parseRequestBody(request, noteSchema);

    await findJobForUser(jobId, user);

    const result = await withIdempotency({
      key: body.idempotencyKey,
      endpoint: "jobs.note",
      userId: user.id,
      jobId,
      action: async () => {
        const event = await createJobEvent({
          jobId,
          userId: user.id,
          type: "NOTE_ADDED",
          metadata: {
            text: body.text,
          },
        });

        return { event };
      },
    });

    return jsonData(result.data);
  });
}
