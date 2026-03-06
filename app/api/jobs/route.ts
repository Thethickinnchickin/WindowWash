import { NextRequest } from "next/server";
import { startOfDay, addDays } from "date-fns";
import { withApiErrorHandling } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocoding";
import { jsonData } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { optimizeJobsByRoute } from "@/lib/route-optimization";

function toDate(value: string | null, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "mine";
    const from = toDate(searchParams.get("from"), startOfDay(new Date()));
    const to = toDate(searchParams.get("to"), addDays(from, 7));
    const status = searchParams.get("status");
    const q = searchParams.get("q")?.trim();
    const optimizeRoute = searchParams.get("optimizeRoute") === "true";
    const originLatRaw = searchParams.get("originLat");
    const originLngRaw = searchParams.get("originLng");
    const originLat = originLatRaw ? Number.parseFloat(originLatRaw) : null;
    const originLng = originLngRaw ? Number.parseFloat(originLngRaw) : null;

    const where = {
      scheduledStart: {
        gte: from,
        lte: to,
      },
      ...(scope === "mine" || user.role === "worker" ? { assignedWorkerId: user.id } : {}),
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              {
                customer: {
                  name: {
                    contains: q,
                    mode: "insensitive" as const,
                  },
                },
              },
              { street: { contains: q, mode: "insensitive" as const } },
              { city: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const jobs = await prisma.job.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phoneE164: true,
            smsOptOut: true,
            email: true,
          },
        },
        assignedWorker: {
          select: {
            id: true,
            name: true,
          },
        },
        payments: {
          select: {
            id: true,
            status: true,
            amountCents: true,
            method: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        scheduledStart: "asc",
      },
    });

    let normalizedJobs = jobs;
    let routeOptimization: {
      optimized: boolean;
      totalDistanceKm: number;
      locatedStops: number;
      unlocatedStops: number;
      usingOrigin: boolean;
    } | null = null;

    if (optimizeRoute && normalizedJobs.length > 1) {
      const coordinateHydratedJobs = await Promise.all(
        normalizedJobs.map(async (job) => {
          if (Number.isFinite(job.lat) && Number.isFinite(job.lng)) {
            return job;
          }

          const coordinates = await geocodeAddress({
            street: job.street,
            city: job.city,
            state: job.state,
            zip: job.zip,
          });

          if (!coordinates) {
            return job;
          }

          try {
            await prisma.job.update({
              where: { id: job.id },
              data: {
                lat: coordinates.lat,
                lng: coordinates.lng,
              },
            });
          } catch {
            // If coordinate save fails, keep route optimization in-memory only.
          }

          return {
            ...job,
            lat: coordinates.lat,
            lng: coordinates.lng,
          };
        }),
      );

      const optimized = optimizeJobsByRoute({
        jobs: coordinateHydratedJobs,
        origin:
          Number.isFinite(originLat) && Number.isFinite(originLng)
            ? { lat: originLat as number, lng: originLng as number }
            : null,
      });

      normalizedJobs = optimized.jobs;
      routeOptimization = {
        optimized: optimized.optimized,
        totalDistanceKm: optimized.totalDistanceKm,
        locatedStops: optimized.locatedStops,
        unlocatedStops: optimized.unlocatedStops,
        usingOrigin: Number.isFinite(originLat) && Number.isFinite(originLng),
      };
    }

    return jsonData({
      jobs: normalizedJobs,
      routeOptimization,
    });
  });
}
