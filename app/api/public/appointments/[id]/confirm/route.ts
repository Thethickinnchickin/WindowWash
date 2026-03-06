import { NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api";
import { verifyAppointmentActionToken } from "@/lib/appointment-action-links";
import { createJobEvent } from "@/lib/events";
import { HttpError, jsonData } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

async function readTokenFromRequest(request: NextRequest) {
  const tokenFromQuery = request.nextUrl.searchParams.get("token");
  if (tokenFromQuery) {
    return tokenFromQuery;
  }

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { token?: string };
      if (body?.token) {
        return body.token;
      }
    }
  }

  return "";
}

async function handle(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await context.params;
    const token = await readTokenFromRequest(request);

    if (!token) {
      throw new HttpError(400, "MISSING_TOKEN", "Confirmation token is required");
    }

    await verifyAppointmentActionToken({
      token,
      expectedJobId: id,
      expectedAction: "confirm",
    });

    const job = await prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        customerConfirmedAt: true,
        scheduledStart: true,
        scheduledEnd: true,
      },
    });

    if (!job) {
      throw new HttpError(404, "NOT_FOUND", "Appointment not found");
    }

    if (job.status === "canceled") {
      throw new HttpError(400, "APPOINTMENT_CANCELED", "This appointment was canceled");
    }

    if (job.customerConfirmedAt) {
      return jsonData({
        confirmed: true,
        alreadyConfirmed: true,
        confirmedAt: job.customerConfirmedAt.toISOString(),
      });
    }

    const confirmedAt = new Date();

    await prisma.job.update({
      where: { id: job.id },
      data: {
        customerConfirmedAt: confirmedAt,
      },
    });

    await createJobEvent({
      jobId: job.id,
      type: "NOTE_ADDED",
      metadata: {
        text: "Customer confirmed appointment from reminder link",
        source: "customer_confirmation_link",
        confirmedAt: confirmedAt.toISOString(),
      },
    });

    return jsonData({
      confirmed: true,
      alreadyConfirmed: false,
      confirmedAt: confirmedAt.toISOString(),
    });
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(request, context);
}
