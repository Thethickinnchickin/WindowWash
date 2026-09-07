import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { pickBestWorkerForSlot } from "@/lib/availability";
import { hashPassword } from "@/lib/auth";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { geocodeAddress } from "@/lib/geocoding";
import { normalizePhoneE164 } from "@/lib/phone";
import { calculateWindowWashEstimate } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { publicAppointmentSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  return withApiErrorHandling(async () => {
    const body = await parseRequestBody(request, publicAppointmentSchema);
    const phoneE164 = normalizePhoneE164(body.phone);
    const email = body.email ? body.email.toLowerCase() : null;
    const pricingInput = body.pricing
      ? {
          ...body.pricing,
          city: body.city,
          state: body.state,
          zip: body.zip,
        }
      : null;
    const estimate = pricingInput ? calculateWindowWashEstimate(pricingInput) : null;
    const amountDueCents = estimate?.totalCents ?? body.amountDueCents ?? 0;
    const estimatedDurationMinutes = estimate?.estimatedDurationMinutes ?? body.estimatedDurationMinutes;

    let customer =
      (email
        ? await prisma.customer.findFirst({
            where: { email },
          })
        : null) ||
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
          ...(email ? { email } : {}),
        },
      });
    }

    let accountCreated = false;
    let accountStatus: "created" | "existing" | "not_requested" = "not_requested";

    if (body.createAccount && email && body.password) {
      const existingAccount = await prisma.customerPortalAccount.findUnique({
        where: { email },
      });

      if (!existingAccount) {
        const passwordHash = await hashPassword(body.password);
        await prisma.customerPortalAccount.create({
          data: {
            customerId: customer.id,
            email,
            passwordHash,
          },
        });
        accountCreated = true;
        accountStatus = "created";
      } else if (existingAccount.customerId !== customer.id) {
        throw {
          status: 409,
          code: "CUSTOMER_ACCOUNT_EMAIL_IN_USE",
          message: "An account already exists for this email. Please sign in instead.",
        };
      } else {
        accountStatus = "existing";
      }
    }

    const scheduledStart = new Date(body.scheduledStart);
    const scheduledEnd = body.scheduledEnd
      ? new Date(body.scheduledEnd)
      : new Date(scheduledStart.getTime() + estimatedDurationMinutes * 60_000);

    if (scheduledEnd.getTime() <= scheduledStart.getTime()) {
      throw {
        status: 400,
        code: "INVALID_SCHEDULE_WINDOW",
        message: "Scheduled end must be after scheduled start",
      };
    }

    const selectedWorker = await pickBestWorkerForSlot({
      state: body.state,
      start: scheduledStart,
      end: scheduledEnd,
    });

    if (!selectedWorker) {
      throw {
        status: 409,
        code: "NO_AVAILABILITY",
        message: "No workers are available for that start time. Please choose another slot.",
      };
    }

    const coordinates = await geocodeAddress({
      street: body.street,
      city: body.city,
      state: body.state,
      zip: body.zip,
    });

    const job = await prisma.job.create({
      data: {
        customerId: customer.id,
        assignedWorkerId: selectedWorker.id,
        scheduledStart,
        scheduledEnd,
        amountDueCents,
        notes: body.notes,
        street: body.street,
        city: body.city,
        state: body.state,
        zip: body.zip,
        lat: coordinates?.lat,
        lng: coordinates?.lng,
      },
    });

    await createJobEvent({
      jobId: job.id,
      type: "JOB_CREATED",
      metadata: {
        source: "customer_portal",
        createAccount: body.createAccount,
        paymentCollection: "after_completion",
        assignedWorkerId: selectedWorker.id,
        pricing: estimate
          ? {
              input: pricingInput,
              estimate,
            }
          : null,
      },
    });

    return jsonData(
      {
        jobId: job.id,
        customerId: customer.id,
        accountCreated,
        accountStatus,
      },
      201,
    );
  });
}
