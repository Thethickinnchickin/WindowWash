CREATE TYPE "JobPhotoType" AS ENUM ('before', 'after', 'issue');

ALTER TABLE "User"
ADD COLUMN "serviceState" TEXT,
ADD COLUMN "dailyJobCapacity" INTEGER NOT NULL DEFAULT 8;

CREATE TABLE "JobPhoto" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "type" "JobPhotoType" NOT NULL,
  "url" TEXT NOT NULL,
  "caption" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JobPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Job_state_scheduledStart_idx" ON "Job"("state", "scheduledStart");
CREATE INDEX "JobPhoto_jobId_createdAt_idx" ON "JobPhoto"("jobId", "createdAt");

ALTER TABLE "JobPhoto"
ADD CONSTRAINT "JobPhoto_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
