CREATE TABLE IF NOT EXISTS "SavedPost" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SavedPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SavedPost_postId_userId_key" ON "SavedPost"("postId", "userId");
CREATE INDEX IF NOT EXISTS "SavedPost_userId_createdAt_idx" ON "SavedPost"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SavedPost_postId_fkey') THEN
    ALTER TABLE "SavedPost"
    ADD CONSTRAINT "SavedPost_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SavedPost_userId_fkey') THEN
    ALTER TABLE "SavedPost"
    ADD CONSTRAINT "SavedPost_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
