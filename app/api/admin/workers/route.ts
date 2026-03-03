import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { hashPassword, requireSessionUser } from "@/lib/auth";
import { jsonData } from "@/lib/errors";
import { assertAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { workerCreateSchema } from "@/lib/validators";

export async function GET() {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);

    const workers = await prisma.user.findMany({
      where: {
        role: "worker",
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return jsonData({ workers });
  });
}

export async function POST(request: NextRequest) {
  return withApiErrorHandling(async () => {
    const user = await requireSessionUser();
    assertAdmin(user);

    const body = await parseRequestBody(request, workerCreateSchema);

    const passwordHash = await hashPassword(body.tempPassword);

    const worker = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash,
        role: "worker",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return jsonData({ worker }, 201);
  });
}
