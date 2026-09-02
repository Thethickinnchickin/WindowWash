import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = {
  status: "ok" | "error" | "skipped";
  latencyMs: number;
  message?: string;
};

function elapsed(startedAt: number) {
  return Date.now() - startedAt;
}

async function withTimeout<T>(label: string, promise: Promise<T>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function checkDatabase(): Promise<Check> {
  const startedAt = Date.now();

  try {
    await withTimeout("database health check", prisma.$queryRaw`SELECT 1`, 2_000);

    return {
      status: "ok",
      latencyMs: elapsed(startedAt),
    };
  } catch (error) {
    return {
      status: "error",
      latencyMs: elapsed(startedAt),
      message: errorMessage(error),
    };
  }
}

async function checkRedis(): Promise<Check> {
  const startedAt = Date.now();
  const redis = getRedisClient();

  if (!redis) {
    return {
      status: process.env.NODE_ENV === "production" ? "error" : "skipped",
      latencyMs: elapsed(startedAt),
      message:
        process.env.NODE_ENV === "production"
          ? "REDIS_URL is required in production"
          : "Redis is not configured for this environment",
    };
  }

  try {
    await withTimeout("redis health check", redis.ping(), 2_000);

    return {
      status: "ok",
      latencyMs: elapsed(startedAt),
    };
  } catch (error) {
    return {
      status: "error",
      latencyMs: elapsed(startedAt),
      message: errorMessage(error),
    };
  }
}

export async function GET() {
  const startedAt = Date.now();
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const redisHealthy =
    redis.status === "ok" || (redis.status === "skipped" && process.env.NODE_ENV !== "production");
  const healthy = database.status === "ok" && redisHealthy;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "error",
      timestamp: new Date().toISOString(),
      latencyMs: elapsed(startedAt),
      checks: {
        database,
        redis,
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
