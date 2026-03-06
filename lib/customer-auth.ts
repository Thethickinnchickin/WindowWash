import { JWTPayload, SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

const CUSTOMER_SESSION_COOKIE = "ww_customer_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SHORT_SESSION_TTL_SECONDS = 60 * 60 * 8;
const SESSION_ROTATE_SECONDS = 60 * 60 * 24;
const SHORT_SESSION_ROTATE_SECONDS = 60 * 60;

type CustomerSessionPayload = JWTPayload & {
  sub: string;
  customerId: string;
  email: string;
  rememberMe: boolean;
};

const secret = new TextEncoder().encode(env.AUTH_SECRET);

export async function createCustomerSessionToken(
  account: { id: string; customerId: string; email: string },
  rememberMe = true,
) {
  const ttlSeconds = rememberMe ? SESSION_TTL_SECONDS : SHORT_SESSION_TTL_SECONDS;

  return new SignJWT({
    customerId: account.customerId,
    email: account.email,
    rememberMe,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(account.id)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret);
}

export async function setCustomerSessionCookie(token: string, rememberMe = true) {
  const store = await cookies();
  store.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: rememberMe ? SESSION_TTL_SECONDS : SHORT_SESSION_TTL_SECONDS,
  });
}

export async function clearCustomerSessionCookie() {
  const store = await cookies();
  store.delete(CUSTOMER_SESSION_COOKIE);
}

async function getPayload(): Promise<CustomerSessionPayload | null> {
  const store = await cookies();
  const token = store.get(CUSTOMER_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify<CustomerSessionPayload>(token, secret);
    return {
      ...verified.payload,
      sub: verified.payload.sub ?? "",
      customerId: verified.payload.customerId,
      email: verified.payload.email,
      rememberMe: Boolean(verified.payload.rememberMe),
    };
  } catch {
    return null;
  }
}

async function maybeRotateCustomerSessionCookie(payload: CustomerSessionPayload) {
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
    customerId: payload.customerId,
    email: payload.email,
    rememberMe: payload.rememberMe,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${payload.rememberMe ? SESSION_TTL_SECONDS : SHORT_SESSION_TTL_SECONDS}s`)
    .sign(secret);

  try {
    await setCustomerSessionCookie(token, payload.rememberMe);
  } catch {
    // Cookie writes are not always allowed (for example, some server component contexts).
  }
}

export async function getCustomerSessionAccount() {
  const payload = await getPayload();

  if (!payload?.sub) {
    return null;
  }

  await maybeRotateCustomerSessionCookie(payload);

  return prisma.customerPortalAccount.findFirst({
    where: {
      id: payload.sub,
      customerId: payload.customerId,
      email: payload.email,
    },
    select: {
      id: true,
      email: true,
      customerId: true,
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneE164: true,
          stripeCustomerId: true,
          paymentMethods: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              brand: true,
              last4: true,
              expMonth: true,
              expYear: true,
              isDefault: true,
              stripePaymentMethodId: true,
            },
          },
        },
      },
    },
  });
}

export async function requireCustomerSessionAccount() {
  const account = await getCustomerSessionAccount();

  if (!account) {
    throw new HttpError(401, "UNAUTHORIZED", "Customer authentication required");
  }

  return account;
}
