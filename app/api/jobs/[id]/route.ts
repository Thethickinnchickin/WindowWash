import { withApiErrorHandling } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { jsonData } from "@/lib/errors";
import { geocodeAddress } from "@/lib/geocoding";
import { findJobWithDetailsForUser } from "@/lib/job-access";
import { serializeJobForUser } from "@/lib/job-presentation";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    const { id } = await context.params;

    const job = await findJobWithDetailsForUser(id, user);
    let hydratedJob = job;

    if (!Number.isFinite(job.lat) || !Number.isFinite(job.lng)) {
      const coordinates = await geocodeAddress({
        street: job.street,
        city: job.city,
        state: job.state,
        zip: job.zip,
      });

      if (coordinates) {
        try {
          await prisma.job.update({
            where: { id: job.id },
            data: {
              lat: coordinates.lat,
              lng: coordinates.lng,
            },
          });
        } catch {
          // Keep the in-memory coordinates even if the cache write fails.
        }

        hydratedJob = {
          ...job,
          lat: coordinates.lat,
          lng: coordinates.lng,
        };
      }
    }

    return jsonData({ job: serializeJobForUser(hydratedJob, user) });
  });
}
