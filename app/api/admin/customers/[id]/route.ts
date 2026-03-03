import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { jsonData } from "@/lib/errors";
import { normalizePhoneE164 } from "@/lib/phone";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { customerPatchSchema } from "@/lib/validators";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);
    const { id } = await context.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        jobs: {
          orderBy: {
            scheduledStart: "desc",
          },
        },
      },
    });

    if (!customer) {
      throw {
        status: 404,
        code: "NOT_FOUND",
        message: "Customer not found",
      };
    }

    return jsonData({ customer });
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);
    const { id } = await context.params;

    const body = await parseRequestBody(request, customerPatchSchema);

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.phone ? { phoneE164: normalizePhoneE164(body.phone) } : {}),
        ...(typeof body.smsOptOut === "boolean" ? { smsOptOut: body.smsOptOut } : {}),
        ...(typeof body.email !== "undefined" ? { email: body.email || null } : {}),
      },
    });

    return jsonData({ customer });
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);
    const { id } = await context.params;

    await prisma.customer.delete({
      where: { id },
    });

    return jsonData({ ok: true });
  });
}
