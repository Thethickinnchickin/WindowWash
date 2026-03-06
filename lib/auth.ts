import bcrypt from "bcryptjs";
import { JWTPayload, SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { User } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/errors";

const SESSION_COOKIE = "ww_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SHORT_SESSION_TTL_SECONDS = 60 * 60 * 8;
const SESSION_ROTATE_SECONDS = 60 * 60 * 24;
const SHORT_SESSION_ROTATE_SECONDS = 60 * 60;

export type SessionUser = Pick<User, "id" | "name" | "email" | "role" | "isActive">;

type SessionPayload = JWTPayload & {
  sub: string;
  role: User["role"];
  email: string;
  name: string;
  rememberMe: boolean;
};

const secret = new TextEncoder().encode(env.AUTH_SECRET);

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSessionToken(user: SessionUser, rememberMe = true) {
  const ttlSeconds = rememberMe ? SESSION_TTL_SECONDS : SHORT_SESSION_TTL_SECONDS;

  return new SignJWT({
    role: user.role,
    email: user.email,
    name: user.name,
    rememberMe,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret);
}

export async function setSessionCookie(token: string, rememberMe = true) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: rememberMe ? SESSION_TTL_SECONDS : SHORT_SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

async function getPayload(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify<SessionPayload>(token, secret);
    return {
      ...verified.payload,
      sub: verified.payload.sub ?? "",
      role: verified.payload.role,
      email: verified.payload.email,
      name: verified.payload.name,
      rememberMe: Boolean(verified.payload.rememberMe),
    };
  } catch {
    return null;
  }
}

async function maybeRotateSessionCookie(payload: SessionPayload) {
  const issuedAt = typeof payload.iat === "number" ? payload.iat : null;
  if (!issuedAt) {
    return;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const rotateAfterSeconds = payload.rememberMe
    ? SESSION_ROTATE_SECONDS
    : SHORT_SESSION_ROTATE_SECONDS;

  if (nowSeconds - issuedAt < rotateAfterSeconds) {
    return;
  }

  const token = await new SignJWT({
    role: payload.role,
    email: payload.email,
    name: payload.name,
    rememberMe: payload.rememberMe,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${payload.rememberMe ? SESSION_TTL_SECONDS : SHORT_SESSION_TTL_SECONDS}s`)
    .sign(secret);

  try {
    await setSessionCookie(token, payload.rememberMe);
  } catch {
    // Cookie writes are not always allowed (for example, some server component contexts).
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const payload = await getPayload();

  if (!payload?.sub) {
    return null;
  }

  await maybeRotateSessionCookie(payload);

  return prisma.user.findFirst({
    where: { id: payload.sub, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });
}

export async function requireSessionUser() {
  const user = await getSessionUser();

  if (!user) {
    throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  }

  return user;
}
