ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "emailVerificationTokenHash" TEXT,
ADD COLUMN IF NOT EXISTS "emailVerificationExpiresAt" TIMESTAMP(3);

UPDATE "User"
SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", "createdAt", NOW())
WHERE "emailVerifiedAt" IS NULL;
