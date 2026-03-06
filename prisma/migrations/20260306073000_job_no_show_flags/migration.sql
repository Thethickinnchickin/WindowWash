ALTER TABLE "Job"
ADD COLUMN "isNoShow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "noShowAt" TIMESTAMP(3),
ADD COLUMN "noShowReason" TEXT;

CREATE INDEX "Job_isNoShow_scheduledStart_idx" ON "Job"("isNoShow", "scheduledStart");
