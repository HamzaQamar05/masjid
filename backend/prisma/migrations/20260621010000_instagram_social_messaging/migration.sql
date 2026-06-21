-- Instagram-style social and messaging support
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ConversationPreference" ADD COLUMN IF NOT EXISTS "folder" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "ConversationPreference" ADD COLUMN IF NOT EXISTS "requestStatus" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "ConversationPreference" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ConversationPreference_ownerId_folder_updatedAt_idx"
  ON "ConversationPreference"("ownerId", "folder", "updatedAt");
CREATE INDEX IF NOT EXISTS "Connection_requesterId_status_idx"
  ON "Connection"("requesterId", "status");
CREATE INDEX IF NOT EXISTS "Connection_receiverId_status_idx"
  ON "Connection"("receiverId", "status");
