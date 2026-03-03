import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/errors";

function toInputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export async function withIdempotency<T>(params: {
  key: string;
  endpoint: string;
  userId: string;
  jobId?: string;
  action: () => Promise<T>;
}) {
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key: params.key },
  });

  if (existing) {
    if (existing.userId !== params.userId) {
      throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key already used");
    }

    return {
      replayed: true,
      data: existing.response as T,
    };
  }

  const response = await params.action();
  const serialized = toInputJson(response);

  try {
    await prisma.idempotencyKey.create({
      data: {
        key: params.key,
        endpoint: params.endpoint,
        userId: params.userId,
        jobId: params.jobId,
        response: serialized,
      },
    });
  } catch {
    const raced = await prisma.idempotencyKey.findUnique({ where: { key: params.key } });

    if (raced?.userId !== params.userId) {
      throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key already used");
    }

    if (raced) {
      return {
        replayed: true,
        data: raced.response as T,
      };
    }
  }

  return {
    replayed: false,
    data: response,
  };
}
