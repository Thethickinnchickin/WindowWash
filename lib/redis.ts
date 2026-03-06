import Redis from "ioredis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const globalForRedis = globalThis as typeof globalThis & {
  redisClient?: Redis;
  redisDisabledNoticeShown?: boolean;
  redisErrorNoticeShown?: boolean;
};

function isRunningOnRailway() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT_NAME ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_ID,
  );
}

function isRailwayInternalRedisUrl(redisUrl: string) {
  try {
    const parsed = new URL(redisUrl);
    return parsed.hostname.endsWith(".railway.internal");
  } catch {
    return false;
  }
}

export function shouldDisableRedisInLocalDev(redisUrl: string) {
  return (
    process.env.NODE_ENV !== "production" &&
    isRailwayInternalRedisUrl(redisUrl) &&
    !isRunningOnRailway()
  );
}

export function getRedisClient() {
  if (!env.REDIS_URL) {
    return null;
  }

  // Railway private DNS names are not resolvable from local dev machines.
  // In development, fall back gracefully to in-memory behavior.
  if (shouldDisableRedisInLocalDev(env.REDIS_URL)) {
    if (!globalForRedis.redisDisabledNoticeShown) {
      globalForRedis.redisDisabledNoticeShown = true;
      logger.warn("Skipping Redis in local dev: Railway internal hostname is not resolvable", {
        host: "railway.internal",
      });
    }
    return null;
  }

  if (!globalForRedis.redisClient) {
    globalForRedis.redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: true,
      lazyConnect: true,
      keepAlive: 30_000,
    });

    globalForRedis.redisClient.on("error", (error) => {
      if (process.env.NODE_ENV === "production") {
        logger.error("Redis client error", {
          error: error.message,
        });
        return;
      }

      if (!globalForRedis.redisErrorNoticeShown) {
        globalForRedis.redisErrorNoticeShown = true;
        logger.warn("Redis client unavailable in dev; falling back to in-memory login limiter", {
          error: error.message,
        });
      }
    });
  }

  return globalForRedis.redisClient;
}
