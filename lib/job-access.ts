import { JobStatus, Prisma } from "@prisma/client";
import { SessionUser } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { assertJobAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const baseInclude = {
  customer: true,
  assignedWorker: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.JobInclude;

export async function findJobForUser(jobId: string, user: SessionUser) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: baseInclude,
  });

  if (!job) {
    throw new HttpError(404, "NOT_FOUND", "Job not found");
  }

  assertJobAccess(user, job);

  return job;
}

export async function findJobWithDetailsForUser(jobId: string, user: SessionUser) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      ...baseInclude,
      events: {
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
      },
      smsLogs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!job) {
    throw new HttpError(404, "NOT_FOUND", "Job not found");
  }

  assertJobAccess(user, job);

  return job;
}

export function assertJobIsNotCanceled(status: JobStatus) {
  if (status === "canceled") {
    throw new HttpError(400, "JOB_CANCELED", "Job is canceled");
  }
}
