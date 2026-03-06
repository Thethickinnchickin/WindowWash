ALTER TABLE "Job" ADD COLUMN "customerConfirmedAt" TIMESTAMP(3);

CREATE INDEX "Job_customerConfirmedAt_idx" ON "Job"("customerConfirmedAt");
