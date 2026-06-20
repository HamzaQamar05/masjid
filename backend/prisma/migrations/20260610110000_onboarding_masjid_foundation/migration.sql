ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

ALTER TABLE "Organization"
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
ADD COLUMN IF NOT EXISTS "heroImageUrl" TEXT,
ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "donationUrl" TEXT,
ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT,
ADD COLUMN IF NOT EXISTS "facebookUrl" TEXT,
ADD COLUMN IF NOT EXISTS "prayerTimes" JSONB,
ADD COLUMN IF NOT EXISTS "iqamahTimes" JSONB;

ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "capacity" INTEGER,
ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "EventRegistration"
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'APPROVED';

CREATE TABLE IF NOT EXISTS "OrganizationFollow" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "notifyPrayers" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationFollow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Opportunity" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "location" TEXT,
  "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "hours" DOUBLE PRECISION,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VolunteerApplication" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "checkedInAt" TIMESTAMP(3),
  "checkedOutAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VolunteerApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationFollow_organizationId_userId_key" ON "OrganizationFollow"("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "OrganizationFollow_userId_notifyPrayers_idx" ON "OrganizationFollow"("userId", "notifyPrayers");
CREATE INDEX IF NOT EXISTS "Organization_type_city_idx" ON "Organization"("type", "city");
CREATE INDEX IF NOT EXISTS "Opportunity_organizationId_type_isActive_idx" ON "Opportunity"("organizationId", "type", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "VolunteerApplication_opportunityId_applicantId_key" ON "VolunteerApplication"("opportunityId", "applicantId");
CREATE INDEX IF NOT EXISTS "VolunteerApplication_applicantId_status_idx" ON "VolunteerApplication"("applicantId", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'OrganizationFollow_organizationId_fkey') THEN
    ALTER TABLE "OrganizationFollow"
    ADD CONSTRAINT "OrganizationFollow_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'OrganizationFollow_userId_fkey') THEN
    ALTER TABLE "OrganizationFollow"
    ADD CONSTRAINT "OrganizationFollow_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Opportunity_organizationId_fkey') THEN
    ALTER TABLE "Opportunity"
    ADD CONSTRAINT "Opportunity_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'VolunteerApplication_opportunityId_fkey') THEN
    ALTER TABLE "VolunteerApplication"
    ADD CONSTRAINT "VolunteerApplication_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'VolunteerApplication_applicantId_fkey') THEN
    ALTER TABLE "VolunteerApplication"
    ADD CONSTRAINT "VolunteerApplication_applicantId_fkey"
    FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'VolunteerApplication_approvedById_fkey') THEN
    ALTER TABLE "VolunteerApplication"
    ADD CONSTRAINT "VolunteerApplication_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
