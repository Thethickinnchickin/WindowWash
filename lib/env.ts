import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  COMPANY_NAME: z.string().default("Window Wash Co"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

function isWeakAuthSecret(value: string) {
  const trimmed = value.trim();

  if (trimmed.length < 32) {
    return true;
  }

  const weakPatterns = [
    /^change-me/i,
    /^changeme/i,
    /^dev-auth-secret-change-me$/i,
    /^your-auth-secret/i,
    /^replace-me/i,
    /example/i,
  ];

  return weakPatterns.some((pattern) => pattern.test(trimmed));
}

const configuredAuthSecret = parsed.data.AUTH_SECRET ?? parsed.data.NEXTAUTH_SECRET;

if (!configuredAuthSecret) {
  throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is required.");
}

if (isWeakAuthSecret(configuredAuthSecret)) {
  throw new Error(
    "AUTH_SECRET is too weak. Use a random secret with at least 32 characters.",
  );
}

export const env = {
  ...parsed.data,
  AUTH_SECRET: configuredAuthSecret,
};

export function hasTwilioConfig() {
  return Boolean(
    env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER,
  );
}

export function hasStripeConfig() {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
}
