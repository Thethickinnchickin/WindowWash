import { JobEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function toInputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export async function createJobEvent(params: {
  jobId: string;
  userId?: string;
  type: JobEventType;
  metadata: Record<string, unknown>;
}) {
  return prisma.jobEvent.create({
    data: {
      jobId: params.jobId,
      userId: params.userId,
      type: params.type,
      metadata: toInputJson(params.metadata),
    },
  });
}
