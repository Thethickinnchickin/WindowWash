import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { findJobForUser } from "@/lib/job-access";
import { readJobPhotoObject } from "@/lib/photo-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; key: string[] }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    const { id: jobId, key } = await context.params;
    await findJobForUser(jobId, user);

    const photo = await readJobPhotoObject({
      jobId,
      key: key.join("/"),
    });

    return new NextResponse(photo.body, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Length": String(photo.body.byteLength),
        "Content-Type": photo.contentType,
      },
    });
  });
}
