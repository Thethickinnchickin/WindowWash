import { NextRequest } from "next/server";
import { endOfDay, startOfDay } from "date-fns";
import { withApiErrorHandling } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { jsonData } from "@/lib/errors";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function parseDate(value: string | null) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

function conflictJobIds(
  jobs: Array<{
    id: string;
    scheduledStart: Date;
    scheduledEnd: Date;
  }>,
) {
  const sorted = [...jobs].sort(
    (left, right) => left.scheduledStart.getTime() - right.scheduledStart.getTime(),
  );
  const ids = new Set<string>();

  for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
    const left = sorted[leftIndex];

    for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex += 1) {
      const right = sorted[rightIndex];

      if (right.scheduledStart >= left.scheduledEnd) {
        break;
      }

      ids.add(left.id);
      ids.add(right.id);
    }
  }

  return Array.from(ids);
}

export async function GET(request: NextRequest) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);

    const baseDate = parseDate(request.nextUrl.searchParams.get("date"));
    const from = startOfDay(baseDate);
    const to = endOfDay(baseDate);

    const [workers, jobs] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: "worker",
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.job.findMany({
        where: {
          scheduledStart: {
            gte: from,
            lte: to,
          },
          status: {
            not: "canceled",
          },
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          scheduledStart: "asc",
        },
      }),
    ]);

    const byWorker = new Map<string, typeof jobs>();
    for (const worker of workers) {
      byWorker.set(worker.id, []);
    }

    const unassigned: typeof jobs = [];
    for (const job of jobs) {
      if (!job.assignedWorkerId) {
        unassigned.push(job);
        continue;
      }

      byWorker.get(job.assignedWorkerId)?.push(job);
    }

    const workerColumns = workers.map((worker) => {
      const workerJobs = byWorker.get(worker.id) || [];
      return {
        worker,
        jobs: workerJobs,
        conflictJobIds: conflictJobIds(
          workerJobs.map((job) => ({
            id: job.id,
            scheduledStart: job.scheduledStart,
            scheduledEnd: job.scheduledEnd,
          })),
        ),
      };
    });

    return jsonData({
      date: from.toISOString(),
      workers: workerColumns,
      unassignedJobs: unassigned,
    });
  });
}
