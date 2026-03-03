import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { jsonData } from "@/lib/errors";
import { normalizePhoneE164 } from "@/lib/phone";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { customerSchema } from "@/lib/validators";

export async function GET() {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);

    const customers = await prisma.customer.findMany({
      include: {
        _count: {
          select: {
            jobs: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return jsonData({ customers });
  });
}

export async function POST(request: NextRequest) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);

    const body = await parseRequestBody(request, customerSchema);
    const phoneE164 = normalizePhoneE164(body.phone);

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        phoneE164,
        email: body.email || null,
        smsOptOut: body.smsOptOut,
      },
    });

    return jsonData({ customer }, 201);
  });
}
