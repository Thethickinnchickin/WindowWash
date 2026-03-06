import { NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { createJobEvent } from "@/lib/events";
import { HttpError, jsonData } from "@/lib/errors";
import { findJobForUser } from "@/lib/job-access";
import { saveJobPhotoUpload } from "@/lib/photo-storage";
import { prisma } from "@/lib/prisma";

type JobPhotoTypeInput = "before" | "after" | "issue";
const allowedTypes = new Set<JobPhotoTypeInput>(["before", "after", "issue"]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    const { id: jobId } = await context.params;
    await findJobForUser(jobId, user);

    const formData = await request.formData();
    const file = formData.get("file");
    const typeRaw = formData.get("type");
    const captionRaw = formData.get("caption");

    if (!(file instanceof File)) {
      throw new HttpError(400, "PHOTO_FILE_REQUIRED", "Photo file is required");
    }

    if (typeof typeRaw !== "string" || !allowedTypes.has(typeRaw as JobPhotoTypeInput)) {
      throw new HttpError(400, "INVALID_PHOTO_TYPE", "Photo type must be before, after, or issue");
    }
    const photoType = typeRaw as JobPhotoTypeInput;

    const caption = typeof captionRaw === "string" ? captionRaw.trim() : "";
    const upload = await saveJobPhotoUpload({
      jobId,
      file,
    });

    const photo = await prisma.jobPhoto.create({
      data: {
        jobId,
        type: photoType,
        url: upload.url,
        caption: caption || null,
      },
    });

    await createJobEvent({
      jobId,
      userId: user.id,
      type: "NOTE_ADDED",
      metadata: {
        text: `Photo uploaded (${typeRaw})`,
        photoId: photo.id,
        photoUrl: photo.url,
        bytes: upload.bytes,
        mimeType: upload.mimeType,
      },
    });

    return jsonData({ photo }, 201);
  });
}
