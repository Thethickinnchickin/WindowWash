DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'PaymentStatus'
      AND e.enumlabel = 'voided'
  ) THEN
    ALTER TYPE "PaymentStatus" ADD VALUE 'voided';
  END IF;
END $$;

CREATE TYPE "PaymentType" AS ENUM ('full', 'partial', 'deposit');
CREATE TYPE "RefundStatus" AS ENUM ('pending', 'succeeded', 'failed');
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('pending', 'retrying', 'succeeded', 'dead_letter');

ALTER TABLE "Payment"
ADD COLUMN "paymentType" "PaymentType" NOT NULL DEFAULT 'full',
ADD COLUMN "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "refundedAt" TIMESTAMP(3);

CREATE TABLE "PaymentRefund" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "status" "RefundStatus" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "stripeRefundId" TEXT,
  "reason" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "payload" JSONB NOT NULL,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRefund_stripeRefundId_key" ON "PaymentRefund"("stripeRefundId");
CREATE INDEX "PaymentRefund_paymentId_createdAt_idx" ON "PaymentRefund"("paymentId", "createdAt");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");
CREATE INDEX "StripeWebhookEvent_status_nextRetryAt_idx" ON "StripeWebhookEvent"("status", "nextRetryAt");
CREATE INDEX "StripeWebhookEvent_createdAt_idx" ON "StripeWebhookEvent"("createdAt");

ALTER TABLE "PaymentRefund"
ADD CONSTRAINT "PaymentRefund_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
