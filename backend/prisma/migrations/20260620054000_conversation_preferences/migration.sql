CREATE TABLE "ConversationPreference" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "otherUserId" TEXT NOT NULL,
  "muted" BOOLEAN NOT NULL DEFAULT false,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ConversationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversationPreference_ownerId_otherUserId_key"
  ON "ConversationPreference"("ownerId", "otherUserId");

CREATE INDEX "ConversationPreference_ownerId_hidden_updatedAt_idx"
  ON "ConversationPreference"("ownerId", "hidden", "updatedAt");

ALTER TABLE "ConversationPreference"
  ADD CONSTRAINT "ConversationPreference_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationPreference"
  ADD CONSTRAINT "ConversationPreference_otherUserId_fkey"
  FOREIGN KEY ("otherUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
