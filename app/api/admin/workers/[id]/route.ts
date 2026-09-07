import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { requireSessionUser } from "@/lib/auth";
import { HttpError, jsonData } from "@/lib/errors";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { workerPatchSchema } from "@/lib/validators";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);

    const { id } = await context.params;
    const body = await parseRequestBody(request, workerPatchSchema);
    const email = body.email?.toLowerCase().trim();

    const worker = await prisma.user.findFirst({
      where: {
        id,
        role: "worker",
      },
      select: {
        id: true,
      },
    });

    if (!worker) {
      throw new HttpError(404, "WORKER_NOT_FOUND", "Worker not found");
    }

    if (email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser && existingUser.id !== id) {
        throw new HttpError(409, "EMAIL_ALREADY_IN_USE", "Email is already in use");
      }
    }

    const updatedWorker = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(email ? { email } : {}),
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
        ...(typeof body.serviceState !== "undefined" ? { serviceState: body.serviceState } : {}),
        ...(typeof body.dailyJobCapacity === "number"
          ? { dailyJobCapacity: body.dailyJobCapacity }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        serviceState: true,
        dailyJobCapacity: true,
      },
    });

    return jsonData({ worker: updatedWorker });
  });
}
