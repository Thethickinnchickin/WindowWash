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
  idempotencyKey: idempotencyKeySchema,
});

export const cashPaymentSchema = z.object({
  amountCents: z.number().int().positive().max(1_000_000_00),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export const checkPaymentSchema = z.object({
  amountCents: z.number().int().positive().max(1_000_000_00),
  checkNumber: z.string().trim().max(100).optional(),
  idempotencyKey: idempotencyKeySchema,
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
  scheduledEnd: z.string().datetime(),
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
  scheduledEnd: z.string().datetime(),
});

export const workerCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().email(),
  tempPassword: z.string().min(8).max(128),
});

export const resetPasswordSchema = z.object({
  tempPassword: z.string().min(8).max(128),
});
