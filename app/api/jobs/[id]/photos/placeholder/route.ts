import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { findJobForUser } from "@/lib/job-access";
import { prisma } from "@/lib/prisma";
import { jobPhotoPlaceholderSchema } from "@/lib/validators";

function placeholderUrl(type: "before" | "after" | "issue", jobId: string) {
  const seed = `${jobId}-${type}-${Date.now()}`;
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1280/720`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    const { id: jobId } = await context.params;
    const body = await parseRequestBody(request, jobPhotoPlaceholderSchema);

    await findJobForUser(jobId, user);

    const photo = await prisma.jobPhoto.create({
      data: {
        jobId,
        type: body.type,
        url: placeholderUrl(body.type, jobId),
        caption:
          body.caption ||
          (body.type === "before"
            ? "Before service photo"
            : body.type === "after"
              ? "After service photo"
              : "Issue photo"),
      },
    });

    await createJobEvent({
      jobId,
      userId: user.id,
      type: "NOTE_ADDED",
      metadata: {
        text: `Photo added (${body.type})`,
        photoId: photo.id,
        photoUrl: photo.url,
        source: "placeholder_photo",
      },
    });

    return jsonData({ photo }, 201);
  });
}
