import { NextRequest } from "next/server";
import { HttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";

type LoginScope = "staff" | "customer";

type RequestCounter = {
  count: number;
  windowStartedAt: number;
};

type LockState = {
  failures: number;
  firstFailureAt: number;
  lockUntil: number | null;
};

const REQUEST_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 20;

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_AFTER_FAILURES = 5;
const LOCKOUT_MS = 20 * 60 * 1000;

const requestCounters = new Map<string, RequestCounter>();
const lockStates = new Map<string, LockState>();
const redisErrorLogged = new Set<string>();

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "unknown";
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase() || "unknown";
}

function lockKey(scope: LoginScope, identifier: string) {
  return `${scope}:${normalizeIdentifier(identifier)}`;
}

function counterKey(scope: LoginScope, identifier: string, ip: string) {
  return `${scope}:${normalizeIdentifier(identifier)}:${ip}`;
}

function redisCounterKey(scope: LoginScope, identifier: string, ip: string) {
  return `ww:login:counter:${scope}:${normalizeIdentifier(identifier)}:${ip}`;
}

function redisFailureKey(scope: LoginScope, identifier: string) {
  return `ww:login:fail:${scope}:${normalizeIdentifier(identifier)}`;
}

function redisLockKey(scope: LoginScope, identifier: string) {
  return `ww:login:lock:${scope}:${normalizeIdentifier(identifier)}`;
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function requireRedisInProduction() {
  const redis = getRedisClient();
  if (redis) {
    return redis;
  }

  if (isProductionRuntime()) {
    throw new HttpError(
      500,
      "REDIS_NOT_CONFIGURED",
      "Redis is required for login security in production",
    );
  }

  return null;
}

function logRedisFallbackOnce(reason: string, error: unknown) {
  const key = `${reason}`;
  if (redisErrorLogged.has(key)) {
    return;
  }

  redisErrorLogged.add(key);

  logger.warn("Redis unavailable for login security; using in-memory fallback", {
    reason,
    error: error instanceof Error ? error.message : String(error),
  });
}

function handleRedisFailure(reason: string, error: unknown) {
  if (error instanceof HttpError) {
    throw error;
  }

  if (isProductionRuntime()) {
    throw new HttpError(
      503,
      "LOGIN_SECURITY_UNAVAILABLE",
      "Login security backend unavailable. Try again shortly.",
    );
  }

  logRedisFallbackOnce(reason, error);
}

function cleanup(now: number) {
  for (const [key, value] of requestCounters.entries()) {
    if (now - value.windowStartedAt > REQUEST_WINDOW_MS * 2) {
      requestCounters.delete(key);
    }
  }

  for (const [key, value] of lockStates.entries()) {
    const staleFailureWindow = now - value.firstFailureAt > FAILURE_WINDOW_MS * 2;
    const lockExpired = !value.lockUntil || now > value.lockUntil + FAILURE_WINDOW_MS;
    if (staleFailureWindow && lockExpired) {
      lockStates.delete(key);
    }
  }
}

function assertLoginAttemptAllowedInMemory(params: {
  scope: LoginScope;
  identifier: string;
  request: NextRequest;
}) {
  const now = Date.now();
  cleanup(now);

  const normalizedIdentifier = normalizeIdentifier(params.identifier);
  const ip = getClientIp(params.request);

  const lock = lockStates.get(lockKey(params.scope, normalizedIdentifier));
  if (lock?.lockUntil && now < lock.lockUntil) {
    const retryAfterMinutes = Math.max(1, Math.ceil((lock.lockUntil - now) / 60_000));
    throw new HttpError(
      429,
      "LOGIN_LOCKED",
      `Too many failed attempts. Try again in ${retryAfterMinutes} minute(s).`,
    );
  }

  const key = counterKey(params.scope, normalizedIdentifier, ip);
  const existing = requestCounters.get(key);
  if (!existing || now - existing.windowStartedAt > REQUEST_WINDOW_MS) {
    requestCounters.set(key, {
      count: 1,
      windowStartedAt: now,
    });
    return;
  }

  existing.count += 1;
  requestCounters.set(key, existing);

  if (existing.count > MAX_ATTEMPTS_PER_WINDOW) {
    throw new HttpError(
      429,
      "RATE_LIMITED",
      "Too many login attempts. Please wait and try again.",
    );
  }
}

async function assertLoginAttemptAllowedInRedis(params: {
  scope: LoginScope;
  identifier: string;
  request: NextRequest;
}) {
  const redis = requireRedisInProduction();
  if (!redis) {
    assertLoginAttemptAllowedInMemory(params);
    return;
  }

  const normalizedIdentifier = normalizeIdentifier(params.identifier);
  const ip = getClientIp(params.request);
  const lockKey = redisLockKey(params.scope, normalizedIdentifier);
  const currentLockTtlMs = await redis.pttl(lockKey);

  if (currentLockTtlMs > 0) {
    const retryAfterMinutes = Math.max(1, Math.ceil(currentLockTtlMs / 60_000));
    throw new HttpError(
      429,
      "LOGIN_LOCKED",
      `Too many failed attempts. Try again in ${retryAfterMinutes} minute(s).`,
    );
  }

  const attemptsKey = redisCounterKey(params.scope, normalizedIdentifier, ip);
  const attempts = await redis.incr(attemptsKey);

  if (attempts === 1) {
    await redis.pexpire(attemptsKey, REQUEST_WINDOW_MS);
  }

  if (attempts > MAX_ATTEMPTS_PER_WINDOW) {
    throw new HttpError(
      429,
      "RATE_LIMITED",
      "Too many login attempts. Please wait and try again.",
    );
  }
}

function recordLoginFailureInMemory(params: {
  scope: LoginScope;
  identifier: string;
}) {
  const now = Date.now();
  const key = lockKey(params.scope, params.identifier);
  const existing = lockStates.get(key);

  if (!existing || now - existing.firstFailureAt > FAILURE_WINDOW_MS) {
    lockStates.set(key, {
      failures: 1,
      firstFailureAt: now,
      lockUntil: null,
    });
    return;
  }

  if (existing.lockUntil && now < existing.lockUntil) {
    return;
  }

  const failures = existing.failures + 1;
  const lockUntil = failures >= LOCKOUT_AFTER_FAILURES ? now + LOCKOUT_MS : null;

  lockStates.set(key, {
    failures: lockUntil ? 0 : failures,
    firstFailureAt: now,
    lockUntil,
  });
}

async function recordLoginFailureInRedis(params: {
  scope: LoginScope;
  identifier: string;
}) {
  const redis = requireRedisInProduction();
  if (!redis) {
    recordLoginFailureInMemory(params);
    return;
  }

  const normalizedIdentifier = normalizeIdentifier(params.identifier);
  const failuresKey = redisFailureKey(params.scope, normalizedIdentifier);
  const lockKey = redisLockKey(params.scope, normalizedIdentifier);

  const failures = await redis.incr(failuresKey);
  if (failures === 1) {
    await redis.pexpire(failuresKey, FAILURE_WINDOW_MS);
  }

  if (failures >= LOCKOUT_AFTER_FAILURES) {
    await redis.set(lockKey, "1", "PX", LOCKOUT_MS);
    await redis.del(failuresKey);
  }
}

function clearLoginFailuresInMemory(params: {
  scope: LoginScope;
  identifier: string;
}) {
  lockStates.delete(lockKey(params.scope, params.identifier));
}

async function clearLoginFailuresInRedis(params: {
  scope: LoginScope;
  identifier: string;
}) {
  const redis = requireRedisInProduction();
  if (!redis) {
    clearLoginFailuresInMemory(params);
    return;
  }

  const normalizedIdentifier = normalizeIdentifier(params.identifier);
  await redis.del(
    redisFailureKey(params.scope, normalizedIdentifier),
    redisLockKey(params.scope, normalizedIdentifier),
  );
}

export async function assertLoginAttemptAllowed(params: {
  scope: LoginScope;
  identifier: string;
  request: NextRequest;
}) {
  try {
    await assertLoginAttemptAllowedInRedis(params);
  } catch (error) {
    handleRedisFailure("assertLoginAttemptAllowed", error);
    assertLoginAttemptAllowedInMemory(params);
  }
}

export async function recordLoginFailure(params: {
  scope: LoginScope;
  identifier: string;
}) {
  try {
    await recordLoginFailureInRedis(params);
  } catch (error) {
    handleRedisFailure("recordLoginFailure", error);
    recordLoginFailureInMemory(params);
  }
}

export async function clearLoginFailures(params: {
  scope: LoginScope;
  identifier: string;
}) {
  try {
    await clearLoginFailuresInRedis(params);
  } catch (error) {
    handleRedisFailure("clearLoginFailures", error);
    clearLoginFailuresInMemory(params);
  }
}
