import { NextRequest } from "next/server";
import { withApiErrorHandling, parseRequestBody } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { getCustomerSessionAccount } from "@/lib/customer-auth";
import { createJobEvent } from "@/lib/events";
import { jsonData } from "@/lib/errors";
import { hasStripeConfig } from "@/lib/env";
import { derivePaymentType } from "@/lib/payments";
import { normalizePhoneE164 } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { ensureStripeCustomer } from "@/lib/stripe-customers";
import { requireStripe } from "@/lib/stripe";
import { publicAppointmentSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  return withApiErrorHandling(async () => {
    const body = await parseRequestBody(request, publicAppointmentSchema);
    const phoneE164 = normalizePhoneE164(body.phone);
    const email = body.email ? body.email.toLowerCase() : null;

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
      : new Date(scheduledStart.getTime() + body.estimatedDurationMinutes * 60_000);

    if (scheduledEnd.getTime() <= scheduledStart.getTime()) {
      throw {
        status: 400,
        code: "INVALID_SCHEDULE_WINDOW",
        message: "Scheduled end must be after scheduled start",
      };
    }

    const job = await prisma.job.create({
      data: {
        customerId: customer.id,
        scheduledStart,
        scheduledEnd,
        amountDueCents: body.amountDueCents ?? 0,
        notes: body.notes,
        street: body.street,
        city: body.city,
        state: body.state,
        zip: body.zip,
      },
    });

    await createJobEvent({
      jobId: job.id,
      type: "JOB_CREATED",
      metadata: {
        source: "customer_portal",
        createAccount: body.createAccount,
        prepayNow: body.prepayNow || body.prepayMode !== "none",
        prepayMode: body.prepayMode,
      },
    });

    let setupIntentClientSecret: string | null = null;
    let prepayClientSecret: string | null = null;
    let prepayAmountCents: number | null = null;
    let prepayStatus: "succeeded_saved_card" | "pending_confirmation" | null = null;

    const wantsPrepay = body.prepayNow || body.prepayMode !== "none";

    if (wantsPrepay) {
      if (!hasStripeConfig()) {
        throw {
          status: 400,
          code: "STRIPE_NOT_CONFIGURED",
          message: "Card prepayment is not configured",
        };
      }

      const requestedAmount =
        body.prepayMode === "full"
          ? job.amountDueCents
          : body.prepayMode === "deposit"
            ? (body.prepayAmountCents ?? 0)
            : (body.prepayAmountCents ?? job.amountDueCents);
      const paymentType =
        body.prepayMode === "deposit"
          ? "deposit"
          : derivePaymentType({
              amountCents: requestedAmount,
              remainingDueCents: job.amountDueCents,
            });

      if (requestedAmount <= 0) {
        throw {
          status: 400,
          code: "INVALID_PREPAY_AMOUNT",
          message: "Prepay amount must be greater than $0",
        };
      }

      if (requestedAmount > job.amountDueCents) {
        throw {
          status: 400,
          code: "INVALID_PREPAY_AMOUNT",
          message: "Prepay amount cannot exceed estimated amount due",
        };
      }

      const stripe = requireStripe();
      const stripeCustomerId = await ensureStripeCustomer(customer);

      if (body.prepayUseSavedCard) {
        const sessionAccount = await getCustomerSessionAccount();
        if (!sessionAccount) {
          throw {
            status: 401,
            code: "CUSTOMER_AUTH_REQUIRED",
            message: "Sign in to use a saved card on file",
          };
        }

        if (sessionAccount.customerId !== customer.id) {
          throw {
            status: 403,
            code: "SAVED_CARD_CUSTOMER_MISMATCH",
            message: "Saved card account does not match this booking customer",
          };
        }

        const savedCard =
          sessionAccount.customer.paymentMethods.find((method) => method.isDefault) ||
          sessionAccount.customer.paymentMethods[0];

        if (!savedCard) {
          throw {
            status: 400,
            code: "NO_SAVED_CARD_ON_FILE",
            message: "No saved card on file. Uncheck saved-card prepay to enter a new card.",
          };
        }

        const payment = await prisma.payment.create({
          data: {
            jobId: job.id,
            status: "pending",
            method: "card",
            paymentType,
            amountCents: requestedAmount,
            cardBrand: savedCard.brand,
            cardLast4: savedCard.last4,
          },
        });

        try {
          const intent = await stripe.paymentIntents.create({
            amount: requestedAmount,
            currency: "usd",
            customer: stripeCustomerId,
            payment_method: savedCard.stripePaymentMethodId,
            off_session: true,
            confirm: true,
            receipt_email: customer.email || undefined,
            metadata: {
              jobId: job.id,
              paymentId: payment.id,
              source: "public_booking_prepay_saved_card",
              requestedBy: "customer",
            },
          });

          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              stripePaymentIntentId: intent.id,
              status: intent.status === "succeeded" ? "succeeded" : "pending",
            },
          });

          await createJobEvent({
            jobId: job.id,
            type: "PAYMENT_RECORDED",
            metadata: {
              paymentId: payment.id,
              method: "card",
              paymentType,
              amountCents: requestedAmount,
              status: intent.status === "succeeded" ? "succeeded" : "pending",
              source: "public_booking_prepay_saved_card",
            },
          });

          prepayAmountCents = requestedAmount;
          if (intent.status === "succeeded") {
            prepayStatus = "succeeded_saved_card";
          } else {
            prepayClientSecret = intent.client_secret;
            prepayStatus = "pending_confirmation";
          }
        } catch (error) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "failed",
            },
          });

          throw {
            status: 400,
            code: "SAVED_CARD_PREPAY_FAILED",
            message:
              error instanceof Error
                ? `Saved-card prepay failed: ${error.message}`
                : "Saved-card prepay failed",
          };
        }
      } else {
        const payment = await prisma.payment.create({
          data: {
            jobId: job.id,
            status: "pending",
            method: "card",
            paymentType,
            amountCents: requestedAmount,
          },
        });

        const intent = await stripe.paymentIntents.create({
          amount: requestedAmount,
          currency: "usd",
          customer: stripeCustomerId,
          automatic_payment_methods: { enabled: true },
          receipt_email: customer.email || undefined,
          metadata: {
            jobId: job.id,
            paymentId: payment.id,
            source: "public_booking_prepay",
            requestedBy: "customer",
          },
        });

        await prisma.payment.update({
          where: { id: payment.id },
          data: { stripePaymentIntentId: intent.id },
        });

        await createJobEvent({
          jobId: job.id,
          type: "PAYMENT_RECORDED",
          metadata: {
            paymentId: payment.id,
            method: "card",
            paymentType,
            amountCents: requestedAmount,
            status: "pending",
            source: "public_booking_prepay",
          },
        });

        prepayClientSecret = intent.client_secret;
        prepayAmountCents = requestedAmount;
        prepayStatus = "pending_confirmation";
      }
    }

    if (body.saveCardOnFile && hasStripeConfig()) {
      const stripe = requireStripe();
      const stripeCustomerId = await ensureStripeCustomer(customer);
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        usage: "off_session",
        payment_method_types: ["card"],
        metadata: {
          localCustomerId: customer.id,
          localJobId: job.id,
        },
      });

      setupIntentClientSecret = setupIntent.client_secret;
    }

    return jsonData(
      {
        jobId: job.id,
        customerId: customer.id,
        accountCreated,
        accountStatus,
        setupIntentClientSecret,
        prepayClientSecret,
        prepayAmountCents,
        prepayStatus,
        stripeConfigured: hasStripeConfig(),
      },
      201,
    );
  });
}
