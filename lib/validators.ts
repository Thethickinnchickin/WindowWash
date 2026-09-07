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
export const pricingInputSchema = z.object({
  servicePackage: z.enum(["exterior", "interior_exterior", "complete"]).optional().default("interior_exterior"),
  windowCount: z.number().int().min(0).max(300),
  screenCount: z.number().int().min(0).max(300).optional().default(0),
  trackCount: z.number().int().min(0).max(300).optional().default(0),
  hardWaterWindowCount: z.number().int().min(0).max(300).optional().default(0),
  postConstruction: z.boolean().optional().default(false),
  stories: z.enum(["one", "two", "three_plus"]).optional().default("one"),
  accessLevel: z.enum(["easy", "standard", "difficult"]).optional().default("easy"),
  frequency: z.enum(["one_time", "quarterly", "monthly"]).optional().default("one_time"),
});

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

export const markPaidSchema = z.object({
  note: z.string().trim().max(500).optional(),
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
    pricing: pricingInputSchema.optional(),
    createAccount: z.boolean().optional().default(false),
    password: z.string().min(8).max(128).optional(),
  })
  .superRefine((value, context) => {
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

export const dispatchAssignSchema = z.object({
  workerId: z.string().min(1).nullable(),
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
  serviceState: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .optional()
    .transform((value) => (value ? value.toUpperCase() : undefined)),
  dailyJobCapacity: z.number().int().min(1).max(50).optional().default(8),
});

export const workerPatchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  serviceState: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .optional()
    .transform((value) => (value ? value.toUpperCase() : undefined)),
  dailyJobCapacity: z.number().int().min(1).max(50).optional(),
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

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  state: z.string().trim().min(2).max(50).optional(),
  durationMinutes: z.coerce.number().int().min(30).max(480).optional().default(120),
});

export const customerRescheduleSchema = z.object({
  scheduledStart: z.string().datetime(),
  estimatedDurationMinutes: z.number().int().min(30).max(480).optional().default(120),
});

export const customerCancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const noShowSchema = z.object({
  isNoShow: z.boolean().default(true),
  reason: z.string().trim().max(500).optional(),
});

export const adminInvoiceEmailSchema = z.object({
  paymentId: z.string().min(1).optional(),
});

export const jobPhotoPlaceholderSchema = z.object({
  type: z.enum(["before", "after", "issue"]),
  caption: z.string().trim().max(240).optional(),
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
