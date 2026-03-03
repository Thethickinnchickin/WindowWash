import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { jsonData } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  return withApiErrorHandling(async () => {
    const body = await parseRequestBody(request, loginSchema);
    const email = body.email.toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        email,
        isActive: true,
      },
    });

    if (!user) {
      throw {
        status: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      };
    }

    const valid = await verifyPassword(body.password, user.passwordHash);

    if (!valid) {
      throw {
        status: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      };
    }

    const token = await createSessionToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    }, body.rememberMe);

    await setSessionCookie(token, body.rememberMe);

    return jsonData({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  });
}
