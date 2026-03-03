import { NextRequest, NextResponse } from "next/server";
import { ZodSchema } from "zod";
import { jsonError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function parseRequestBody<T>(request: NextRequest, schema: ZodSchema<T>) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: parsed.error.flatten(),
    };
  }

  return parsed.data;
}

export async function withApiErrorHandling(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      "code" in error &&
      "message" in error
    ) {
      const typed = error as {
        status: number;
        code: string;
        message: string;
        details?: unknown;
      };

      return jsonError(typed.status, typed.code, typed.message, typed.details);
    }

    logger.error("Unhandled API error", {
      error: error instanceof Error ? error.message : String(error),
    });

    return jsonError(500, "INTERNAL_SERVER_ERROR", "Unexpected server error");
  }
}
