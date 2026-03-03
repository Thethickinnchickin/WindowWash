import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { jsonData } from "@/lib/errors";
import { withIdempotency } from "@/lib/idempotency";
import { findJobForUser } from "@/lib/job-access";
import { prisma } from "@/lib/prisma";
import { issueSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    const { id: jobId } = await context.params;
    const body = await parseRequestBody(request, issueSchema);

    const job = await findJobForUser(jobId, user);

    const result = await withIdempotency({
      key: body.idempotencyKey,
      endpoint: "jobs.issue",
      userId: user.id,
      jobId,
      action: async () => {
        const updated = await prisma.job.update({
          where: { id: jobId },
          data:
            job.status === "canceled" || job.status === "paid"
              ? {}
              : {
                  status: "needs_attention",
                },
        });

        await prisma.jobEvent.create({
          data: {
            jobId,
            userId: user.id,
            type: "ISSUE_REPORTED",
            metadata: {
              text: body.text,
            },
          },
        });

        return {
          job: updated,
        };
      },
    });

    return jsonData(result.data);
  });
}
