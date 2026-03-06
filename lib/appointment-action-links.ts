import { jwtVerify, SignJWT } from "jose";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/errors";

export type AppointmentAction = "confirm";

function secretKey() {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function createAppointmentActionToken(params: {
  jobId: string;
  action: AppointmentAction;
  expiresAt: Date;
}) {
  const expiration = Math.floor(params.expiresAt.getTime() / 1000);

  return new SignJWT({
    jobId: params.jobId,
    action: params.action,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(secretKey());
}

export async function verifyAppointmentActionToken(params: {
  token: string;
  expectedJobId: string;
  expectedAction: AppointmentAction;
}) {
  try {
    const { payload } = await jwtVerify(params.token, secretKey(), {
      algorithms: ["HS256"],
    });

    const tokenJobId = typeof payload.jobId === "string" ? payload.jobId : "";
    const tokenAction = typeof payload.action === "string" ? payload.action : "";

    if (!tokenJobId || !tokenAction) {
      throw new HttpError(401, "INVALID_ACTION_TOKEN", "Invalid confirmation token");
    }

    if (tokenJobId !== params.expectedJobId || tokenAction !== params.expectedAction) {
      throw new HttpError(401, "INVALID_ACTION_TOKEN", "Token does not match this appointment action");
    }

    return payload;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, "INVALID_ACTION_TOKEN", "Invalid or expired confirmation token");
  }
}
