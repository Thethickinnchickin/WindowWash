import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { verifyPassword } from "@/lib/auth";
import {
  createCustomerSessionToken,
  setCustomerSessionCookie,
} from "@/lib/customer-auth";
import { jsonData } from "@/lib/errors";
import {
  assertLoginAttemptAllowed,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/login-security";
import { prisma } from "@/lib/prisma";
import { customerPortalLoginSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  return withApiErrorHandling(async () => {
    const body = await parseRequestBody(request, customerPortalLoginSchema);
    const email = body.email.toLowerCase().trim();

    await assertLoginAttemptAllowed({
      scope: "customer",
      identifier: email,
      request,
    });

    const account = await prisma.customerPortalAccount.findUnique({
      where: {
        email,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!account) {
      await recordLoginFailure({
        scope: "customer",
        identifier: email,
      });

      throw {
        status: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      };
    }

    const valid = await verifyPassword(body.password, account.passwordHash);

    if (!valid) {
      await recordLoginFailure({
        scope: "customer",
        identifier: email,
      });

      throw {
        status: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      };
    }

    await clearLoginFailures({
      scope: "customer",
      identifier: email,
    });

    const token = await createCustomerSessionToken(
      {
        id: account.id,
        customerId: account.customerId,
        email: account.email,
      },
      body.rememberMe,
    );

    await setCustomerSessionCookie(token, body.rememberMe);

    return jsonData({
      account: {
        id: account.id,
        email: account.email,
        customerId: account.customerId,
        customerName: account.customer.name,
      },
    });
  });
}
