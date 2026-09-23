CREATE INDEX "JobEvent_createdAt_idx" ON "JobEvent"("createdAt");
CREATE INDEX "JobEvent_type_createdAt_idx" ON "JobEvent"("type", "createdAt");
CREATE INDEX "JobEvent_userId_createdAt_idx" ON "JobEvent"("userId", "createdAt");
