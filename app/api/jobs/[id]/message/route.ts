import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { withIdempotency } from "@/lib/idempotency";
import { findJobForUser } from "@/lib/job-access";
import { sendSmsForJob } from "@/lib/sms/service";
import { messageSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    const { id: jobId } = await context.params;
    const body = await parseRequestBody(request, messageSchema);

    const job = await findJobForUser(jobId, user);

    const result = await withIdempotency({
      key: body.idempotencyKey,
      endpoint: "jobs.message",
      userId: user.id,
      jobId,
      action: async () => {
        const sms = await sendSmsForJob({
          job,
          templateKey: body.templateKey,
          customText: body.customText,
          userId: user.id,
        });

        await createJobEvent({
          jobId,
          userId: user.id,
          type: "MESSAGE_SENT",
          metadata: {
            templateKey: body.templateKey,
            ...(body.customText ? { customText: body.customText } : {}),
          },
        });

        return { sms };
      },
    });

    return jsonData(result.data);
  });
}
