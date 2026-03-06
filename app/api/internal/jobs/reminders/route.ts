import { NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api";
import { env } from "@/lib/env";
import { jsonData } from "@/lib/errors";
import { enqueueReminderDispatchJob } from "@/lib/queue/background-queue";
import { runAppointmentReminderDispatch } from "@/lib/job-reminders";

function assertCronAuthorized(request: NextRequest) {
  if (!env.CRON_SECRET) {
    throw {
      status: 500,
      code: "CRON_SECRET_NOT_CONFIGURED",
      message: "CRON_SECRET must be configured for reminder dispatch",
    };
  }

  const provided = request.headers.get("x-cron-secret");
  if (!provided || provided !== env.CRON_SECRET) {
    throw {
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid cron secret",
    };
  }
}

function resolveBaseUrl(request: NextRequest) {
  const baseFromQuery = request.nextUrl.searchParams.get("baseUrl")?.trim();
  if (baseFromQuery) {
    return baseFromQuery;
  }

  if (process.env.PORTAL_BASE_URL?.trim()) {
    return process.env.PORTAL_BASE_URL.trim();
  }

  if (process.env.APP_BASE_URL?.trim()) {
    return process.env.APP_BASE_URL.trim();
  }

  return request.nextUrl.origin;
}

async function handle(request: NextRequest) {
  return withApiErrorHandling(async () => {
    assertCronAuthorized(request);

    const mode = request.nextUrl.searchParams.get("mode") || "queue";
    const baseUrl = resolveBaseUrl(request);

    if (mode === "sync") {
      const result = await runAppointmentReminderDispatch({
        baseUrl,
      });

      return jsonData({
        mode: "sync",
        ...result,
      });
    }

    const enqueue = await enqueueReminderDispatchJob({
      baseUrl,
    });

    if (!enqueue.queued) {
      const fallback = await runAppointmentReminderDispatch({
        baseUrl,
      });

      return jsonData({
        mode: "sync_fallback",
        queue: enqueue,
        ...fallback,
      });
    }

    return jsonData({
      mode: "queue",
      queue: enqueue,
    });
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
