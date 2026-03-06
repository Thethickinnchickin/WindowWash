import { z } from "zod";

const jobStatusValues = [
  "scheduled",
  "on_my_way",
  "in_progress",
  "finished",
  "paid",
  "canceled",
  "needs_attention",
] as const;

export const idempotencyKeySchema = z.string().min(8).max(128);
export const paymentTypeSchema = z.enum(["full", "partial", "deposit"]);
export const prepayModeSchema = z.enum(["none", "full", "deposit"]);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional().default(true),
});

export const statusUpdateSchema = z.object({
  status: z.enum(jobStatusValues),
  etaMinutes: z.number().int().min(1).max(480).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export const noteSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  idempotencyKey: idempotencyKeySchema,
});

export const messageSchema = z.object({
  templateKey: z.enum(["ON_MY_WAY", "STARTED", "FINISHED", "PAID", "CUSTOM"]),
  customText: z.string().trim().max(320).optional(),
  idempotencyKey: idempotencyKeySchema,
}).superRefine((value, context) => {
  if (value.templateKey === "CUSTOM" && !value.customText?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customText"],
      message: "customText is required when templateKey is CUSTOM",
    });
  }
});

export const issueSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  idempotencyKey: idempotencyKeySchema,
});

export const paymentIntentSchema = z.object({
  amountCents: z.number().int().positive().max(1_000_000_00),
  paymentType: paymentTypeSchema.optional(),
  idempotencyKey: idempotencyKeySchema,
});

export const cashPaymentSchema = z.object({
  amountCents: z.number().int().positive().max(1_000_000_00),
  paymentType: paymentTypeSchema.optional(),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export const checkPaymentSchema = z.object({
  amountCents: z.number().int().positive().max(1_000_000_00),
  paymentType: paymentTypeSchema.optional(),
  checkNumber: z.string().trim().max(100).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export const savedCardPaymentSchema = z.object({
  amountCents: z.number().int().positive().max(1_000_000_00),
  paymentType: paymentTypeSchema.optional(),
  customerPaymentMethodId: z.string().min(1),
  idempotencyKey: idempotencyKeySchema,
});

export const publicAppointmentSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    phone: z.string().trim().min(7).max(32),
    email: z.string().email().optional().or(z.literal("")),
    street: z.string().trim().min(1).max(240),
    city: z.string().trim().min(1).max(120),
    state: z.string().trim().min(2).max(50),
    zip: z.string().trim().min(3).max(20),
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime().optional(),
    estimatedDurationMinutes: z.number().int().min(30).max(480).optional().default(120),
    notes: z.string().trim().max(1000).optional(),
    amountDueCents: z.number().int().nonnegative().max(1_000_000_00).optional(),
    prepayNow: z.boolean().optional().default(false),
    prepayMode: prepayModeSchema.optional().default("none"),
    prepayUseSavedCard: z.boolean().optional().default(false),
    prepayAmountCents: z.number().int().positive().max(1_000_000_00).optional(),
    createAccount: z.boolean().optional().default(false),
    password: z.string().min(8).max(128).optional(),
    saveCardOnFile: z.boolean().optional().default(false),
  })
  .superRefine((value, context) => {
    const wantsPrepay = value.prepayNow || value.prepayMode !== "none";

    if (value.createAccount && !value.email) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Email is required to create an account",
      });
    }

    if (value.createAccount && !value.password) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Password is required to create an account",
      });
    }

    if (wantsPrepay && (!value.amountDueCents || value.amountDueCents <= 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountDueCents"],
        message: "Estimated amount must be greater than $0 to prepay",
      });
    }

    if (value.prepayUseSavedCard && !wantsPrepay) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prepayUseSavedCard"],
        message: "Enable prepay to use a saved card",
      });
    }

    if (value.prepayMode === "none" && typeof value.prepayAmountCents === "number" && !value.prepayNow) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prepayMode"],
        message: "Select a prepay mode before setting a prepay amount",
      });
    }

    if (
      value.prepayMode === "deposit" &&
      (!value.prepayAmountCents || value.prepayAmountCents <= 0)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prepayAmountCents"],
        message: "Deposit amount is required when prepay mode is deposit",
      });
    }

    if (
      wantsPrepay &&
      typeof value.prepayAmountCents === "number" &&
      typeof value.amountDueCents === "number" &&
      value.prepayAmountCents > value.amountDueCents
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prepayAmountCents"],
        message: "Prepay amount cannot exceed estimated amount due",
      });
    }

    if (
      value.prepayMode === "deposit" &&
      typeof value.prepayAmountCents === "number" &&
      typeof value.amountDueCents === "number" &&
      value.prepayAmountCents >= value.amountDueCents
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prepayAmountCents"],
        message: "Deposit must be less than the full estimated amount",
      });
    }
  });

export const customerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(7).max(32),
  email: z.string().email().optional().or(z.literal("")),
  smsOptOut: z.boolean().optional().default(false),
});

export const customerPatchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  phone: z.string().trim().min(7).max(32).optional(),
  email: z.string().email().optional().or(z.literal("")),
  smsOptOut: z.boolean().optional(),
});

export const jobSchema = z.object({
  customerId: z.string().min(1),
  assignedWorkerId: z.string().min(1).optional().nullable(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime().optional(),
  estimatedDurationMinutes: z.number().int().min(30).max(480).optional().default(120),
  amountDueCents: z.number().int().nonnegative().max(1_000_000_00),
  notes: z.string().max(1000).optional(),
  status: z.enum(jobStatusValues).optional(),
  street: z.string().trim().min(1).max(240),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(2).max(50),
  zip: z.string().trim().min(3).max(20),
});

export const assignSchema = z.object({
  workerId: z.string().min(1),
});

export const cancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const rescheduleSchema = z.object({
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime().optional(),
  estimatedDurationMinutes: z.number().int().min(30).max(480).optional().default(120),
});

export const workerCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().email(),
  tempPassword: z.string().min(8).max(128),
});

export const resetPasswordSchema = z.object({
  tempPassword: z.string().min(8).max(128),
});

export const adminPaymentRefundSchema = z.object({
  amountCents: z.number().int().positive().max(1_000_000_00).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const adminPaymentVoidSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const customerPortalLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional().default(true),
});

export const customerPortalRegisterSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    phone: z.string().trim().min(7).max(32),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
    rememberMe: z.boolean().optional().default(true),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });
