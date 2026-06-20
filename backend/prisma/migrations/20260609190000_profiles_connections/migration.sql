ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "location" TEXT,
ADD COLUMN IF NOT EXISTS "education" TEXT,
ADD COLUMN IF NOT EXISTS "experience" TEXT,
ADD COLUMN IF NOT EXISTS "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "hobbies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "availability" TEXT;

ALTER TABLE "Message"
ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "Connection" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Connection_requesterId_receiverId_key" ON "Connection"("requesterId", "receiverId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Connection_requesterId_fkey'
  ) THEN
    ALTER TABLE "Connection"
    ADD CONSTRAINT "Connection_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Connection_receiverId_fkey'
  ) THEN
    ALTER TABLE "Connection"
    ADD CONSTRAINT "Connection_receiverId_fkey"
    FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
