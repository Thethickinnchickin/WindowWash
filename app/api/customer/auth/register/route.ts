import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import {
  createCustomerSessionToken,
  setCustomerSessionCookie,
} from "@/lib/customer-auth";
import { jsonData } from "@/lib/errors";
import { normalizePhoneE164 } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { customerPortalRegisterSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  return withApiErrorHandling(async () => {
    const body = await parseRequestBody(request, customerPortalRegisterSchema);
    const email = body.email.toLowerCase().trim();
    const phoneE164 = normalizePhoneE164(body.phone);

    const existingAccount = await prisma.customerPortalAccount.findUnique({
      where: { email },
    });

    if (existingAccount) {
      throw {
        status: 409,
        code: "CUSTOMER_ACCOUNT_EXISTS",
        message: "An account with this email already exists. Please sign in.",
      };
    }

    let customer =
      (await prisma.customer.findFirst({
        where: { email },
      })) ||
      (await prisma.customer.findFirst({
        where: { phoneE164 },
      }));

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: body.name,
          phoneE164,
          email,
        },
      });
    } else {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: body.name,
          phoneE164,
          email,
        },
      });
    }

    const passwordHash = await hashPassword(body.password);
    const account = await prisma.customerPortalAccount.create({
      data: {
        customerId: customer.id,
        email,
        passwordHash,
      },
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

    return jsonData(
      {
        account: {
          id: account.id,
          email: account.email,
          customerId: account.customerId,
          customerName: customer.name,
        },
      },
      201,
    );
  });
}
