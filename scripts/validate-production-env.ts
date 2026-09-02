type Env = Record<string, string | undefined>;

const env = process.env as Env;
const failures: string[] = [];
const warnings: string[] = [];

const required = [
  "DATABASE_URL",
  "REDIS_URL",
  "APP_BASE_URL",
  "PORTAL_BASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "CRON_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_FROM",
  "PHOTO_STORAGE_DRIVER",
  "COMPANY_NAME",
];

const weakPatterns = [
  /^change-me/i,
  /^changeme/i,
  /^dev-auth-secret-change-me$/i,
  /^your-/i,
  /^replace-/i,
  /^replace-me/i,
  /example/i,
  /password/i,
  /test_replace_me/i,
];

function value(name: string) {
  return env[name]?.trim() ?? "";
}

function fail(message: string) {
  failures.push(message);
}

function isWeak(valueToCheck: string) {
  return weakPatterns.some((pattern) => pattern.test(valueToCheck));
}

function requireValue(name: string) {
  const current = value(name);
  if (!current) {
    fail(`${name} is required.`);
    return "";
  }

  return current;
}

function requireUrl(name: string, protocols: string[]) {
  const current = requireValue(name);
  if (!current) {
    return;
  }

  try {
    const parsed = new URL(current);
    if (!protocols.includes(parsed.protocol)) {
      fail(`${name} must use one of these protocols: ${protocols.join(", ")}.`);
    }
  } catch {
    fail(`${name} must be a valid URL.`);
  }
}

function requireHttpsUrl(name: string) {
  const current = requireValue(name);
  if (!current) {
    return;
  }

  try {
    const parsed = new URL(current);
    if (parsed.protocol !== "https:") {
      fail(`${name} must be an https:// URL in production.`);
    }
  } catch {
    fail(`${name} must be a valid URL.`);
  }
}

function requireSecret(name: string, minLength = 32) {
  const current = requireValue(name);
  if (!current) {
    return;
  }

  if (current.length < minLength) {
    fail(`${name} must be at least ${minLength} characters.`);
  }

  if (isWeak(current)) {
    fail(`${name} still looks like a placeholder or weak value.`);
  }
}

function requireStripeKey(name: string, expectedPrefix: string) {
  const current = requireValue(name);
  if (!current) {
    return;
  }

  if (!current.startsWith(expectedPrefix)) {
    fail(`${name} must use a live Stripe key that starts with ${expectedPrefix}.`);
  }

  if (isWeak(current)) {
    fail(`${name} still looks like a placeholder or weak value.`);
  }
}

function validateTwilioValues() {
  const accountSid = value("TWILIO_ACCOUNT_SID");
  const authToken = value("TWILIO_AUTH_TOKEN");
  const fromNumber = value("TWILIO_FROM_NUMBER");

  if (accountSid && !accountSid.startsWith("AC")) {
    fail("TWILIO_ACCOUNT_SID should start with AC.");
  }

  if (authToken && authToken.length < 16) {
    fail("TWILIO_AUTH_TOKEN looks too short.");
  }

  if (fromNumber && !fromNumber.startsWith("+")) {
    fail("TWILIO_FROM_NUMBER should be in E.164 format, for example +15555550123.");
  }
}

function requireInteger(name: string, min: number, max?: number) {
  const current = value(name);
  if (!current) {
    return;
  }

  const parsed = Number.parseInt(current, 10);
  if (!Number.isInteger(parsed) || parsed < min || (max !== undefined && parsed > max)) {
    fail(`${name} must be an integer${max === undefined ? ` >= ${min}` : ` between ${min} and ${max}`}.`);
  }
}

function validateTrustedOrigins() {
  const current = value("CSRF_TRUSTED_ORIGINS");
  if (!current) {
    return;
  }

  for (const origin of current.split(",").map((item) => item.trim()).filter(Boolean)) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== "https:") {
        fail(`CSRF_TRUSTED_ORIGINS entry must use https://: ${origin}`);
      }
    } catch {
      fail(`CSRF_TRUSTED_ORIGINS contains an invalid URL: ${origin}`);
    }
  }
}

function validatePhotoStorage() {
  const driver = value("PHOTO_STORAGE_DRIVER").toLowerCase();

  if (driver !== "s3") {
    fail("PHOTO_STORAGE_DRIVER must be s3 in production so uploads survive deploys and web replicas.");
    return;
  }

  const bucket = value("S3_BUCKET") || value("BUCKET");
  const accessKeyId = value("S3_ACCESS_KEY_ID") || value("ACCESS_KEY_ID");
  const secretAccessKey = value("S3_SECRET_ACCESS_KEY") || value("SECRET_ACCESS_KEY");
  const region = value("S3_REGION") || value("REGION");

  if (!bucket) {
    fail("S3_BUCKET or Railway BUCKET is required when PHOTO_STORAGE_DRIVER=s3.");
  }

  if (!accessKeyId) {
    fail("S3_ACCESS_KEY_ID or Railway ACCESS_KEY_ID is required when PHOTO_STORAGE_DRIVER=s3.");
  }

  if (!secretAccessKey) {
    fail("S3_SECRET_ACCESS_KEY or Railway SECRET_ACCESS_KEY is required when PHOTO_STORAGE_DRIVER=s3.");
  }

  if (!region) {
    fail("S3_REGION or Railway REGION is required when PHOTO_STORAGE_DRIVER=s3.");
  }

  if (value("S3_ENDPOINT")) {
    try {
      const parsed = new URL(value("S3_ENDPOINT"));
      if (parsed.protocol !== "https:") {
        fail("S3_ENDPOINT must use https://.");
      }
    } catch {
      fail("S3_ENDPOINT must be a valid URL.");
    }
  }
}

for (const name of required) {
  requireValue(name);
}

const authSecret = value("AUTH_SECRET") || value("NEXTAUTH_SECRET");
if (!authSecret) {
  fail("AUTH_SECRET or NEXTAUTH_SECRET is required.");
} else {
  if (authSecret.length < 32) {
    fail("AUTH_SECRET or NEXTAUTH_SECRET must be at least 32 characters.");
  }

  if (isWeak(authSecret)) {
    fail("AUTH_SECRET or NEXTAUTH_SECRET still looks like a placeholder or weak value.");
  }
}

requireUrl("DATABASE_URL", ["postgresql:", "postgres:"]);
requireUrl("REDIS_URL", ["redis:", "rediss:"]);
requireHttpsUrl("APP_BASE_URL");
requireHttpsUrl("PORTAL_BASE_URL");
requireStripeKey("STRIPE_SECRET_KEY", "sk_live_");
requireStripeKey("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_live_");
requireSecret("STRIPE_WEBHOOK_SECRET", 16);
requireSecret("CRON_SECRET", 32);
requireSecret("SMTP_PASS", 8);
requireInteger("SMTP_PORT", 1, 65_535);
requireInteger("CUSTOMER_RESCHEDULE_MIN_HOURS", 0);
requireInteger("CUSTOMER_CANCEL_MIN_HOURS", 0);
requireInteger("CUSTOMER_RESCHEDULE_FEE_WINDOW_HOURS", 0);
requireInteger("CUSTOMER_CANCEL_FEE_WINDOW_HOURS", 0);
requireInteger("CUSTOMER_RESCHEDULE_FEE_CENTS", 0);
requireInteger("CUSTOMER_CANCEL_FEE_CENTS", 0);
validateTwilioValues();
validateTrustedOrigins();
validatePhotoStorage();

if (failures.length > 0) {
  console.error("Production environment validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  if (warnings.length > 0) {
    console.warn("");
    console.warn("Warnings:");
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  process.exit(1);
}

console.log("Production environment validation passed.");
for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}
