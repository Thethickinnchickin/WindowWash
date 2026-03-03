import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { hashPassword, requireSessionUser } from "@/lib/auth";
import { jsonData } from "@/lib/errors";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);

    const { id } = await context.params;
    const body = await parseRequestBody(request, resetPasswordSchema);
    const passwordHash = await hashPassword(body.tempPassword);

    await prisma.user.update({
      where: {
        id,
      },
      data: {
        passwordHash,
      },
    });

    return jsonData({ ok: true });
  });
}
