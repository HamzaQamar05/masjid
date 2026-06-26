CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiCache" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "sourceHash" TEXT,
    "input" JSONB,
    "output" JSONB NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiNewsletterDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceRangeStart" TIMESTAMP(3),
    "sourceRangeEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiNewsletterDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiCache_cacheKey_key" ON "AiCache"("cacheKey");
CREATE INDEX "AiUsageLog_feature_createdAt_idx" ON "AiUsageLog"("feature", "createdAt");
CREATE INDEX "AiUsageLog_userId_createdAt_idx" ON "AiUsageLog"("userId", "createdAt");
CREATE INDEX "AiUsageLog_organizationId_createdAt_idx" ON "AiUsageLog"("organizationId", "createdAt");
CREATE INDEX "AiCache_feature_createdAt_idx" ON "AiCache"("feature", "createdAt");
CREATE INDEX "AiCache_organizationId_feature_idx" ON "AiCache"("organizationId", "feature");
CREATE INDEX "AiNewsletterDraft_organizationId_status_createdAt_idx" ON "AiNewsletterDraft"("organizationId", "status", "createdAt");

ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiCache" ADD CONSTRAINT "AiCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiCache" ADD CONSTRAINT "AiCache_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiNewsletterDraft" ADD CONSTRAINT "AiNewsletterDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiNewsletterDraft" ADD CONSTRAINT "AiNewsletterDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
