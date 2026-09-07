import { JobStatus, Prisma } from "@prisma/client";
import { SessionUser } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import {
  assertCollectPaymentAllowed,
  assertJobAccess,
  canViewJobPaymentInfo,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const jobCustomerPublicSelect = {
  id: true,
  name: true,
  phoneE164: true,
  email: true,
  smsOptOut: true,
} satisfies Prisma.CustomerSelect;

export const assignedWorkerPublicSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

const baseInclude = {
  customer: {
    select: jobCustomerPublicSelect,
  },
  assignedWorker: {
    select: assignedWorkerPublicSelect,
  },
} satisfies Prisma.JobInclude;

const paymentCollectionInclude = {
  customer: {
    select: jobCustomerPublicSelect,
  },
  assignedWorker: {
    select: assignedWorkerPublicSelect,
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

export async function findJobForPaymentCollection(jobId: string, user: SessionUser) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: paymentCollectionInclude,
  });

  if (!job) {
    throw new HttpError(404, "NOT_FOUND", "Job not found");
  }

  assertJobAccess(user, job);
  assertCollectPaymentAllowed(user, job.status);

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
      photos: {
        orderBy: { createdAt: "desc" },
      },
      smsLogs: {
        select: {
          id: true,
          templateKey: true,
          status: true,
          error: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!job) {
    throw new HttpError(404, "NOT_FOUND", "Job not found");
  }

  assertJobAccess(user, job);

  if (!canViewJobPaymentInfo(user, job.status)) {
    return {
      ...job,
      customer: {
        ...job.customer,
        paymentMethods: [],
      },
      payments: [],
    };
  }

  const payments = await prisma.payment.findMany({
    where: {
      jobId,
    },
    select: {
      id: true,
      status: true,
      method: true,
      paymentType: true,
      amountCents: true,
      refundedAmountCents: true,
      cardBrand: true,
      cardLast4: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    ...job,
    customer: {
      ...job.customer,
      paymentMethods: [],
    },
    payments,
  };
}

export function assertJobIsNotCanceled(status: JobStatus) {
  if (status === "canceled") {
    throw new HttpError(400, "JOB_CANCELED", "Job is canceled");
  }
}
