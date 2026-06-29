ALTER TABLE "Post"
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Post"
SET "status" = 'PUBLISHED',
    "publishedAt" = COALESCE("publishedAt", "createdAt")
WHERE "status" IS NULL OR "status" = '';

CREATE INDEX IF NOT EXISTS "Post_organizationId_status_publishAt_idx" ON "Post"("organizationId", "status", "publishAt");

CREATE TABLE IF NOT EXISTS "DonationCampaign" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "goalCents" INTEGER,
  "raisedCents" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DonationCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Donation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "campaignId" TEXT,
  "userId" TEXT,
  "donorName" TEXT,
  "donorEmail" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "recurring" BOOLEAN NOT NULL DEFAULT false,
  "frequency" TEXT,
  "anonymous" BOOLEAN NOT NULL DEFAULT false,
  "receiptEmailSentAt" TIMESTAMP(3),
  "provider" TEXT,
  "providerRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DonationCampaign_organizationId_fkey'
  ) THEN
    ALTER TABLE "DonationCampaign"
    ADD CONSTRAINT "DonationCampaign_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Donation_organizationId_fkey'
  ) THEN
    ALTER TABLE "Donation"
    ADD CONSTRAINT "Donation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Donation_campaignId_fkey'
  ) THEN
    ALTER TABLE "Donation"
    ADD CONSTRAINT "Donation_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "DonationCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Donation_userId_fkey'
  ) THEN
    ALTER TABLE "Donation"
    ADD CONSTRAINT "Donation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "DonationCampaign_organizationId_active_createdAt_idx" ON "DonationCampaign"("organizationId", "active", "createdAt");
CREATE INDEX IF NOT EXISTS "Donation_organizationId_createdAt_idx" ON "Donation"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Donation_campaignId_createdAt_idx" ON "Donation"("campaignId", "createdAt");
CREATE INDEX IF NOT EXISTS "Donation_userId_createdAt_idx" ON "Donation"("userId", "createdAt");
