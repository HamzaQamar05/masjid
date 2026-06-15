ALTER TABLE "User" ADD COLUMN "whatsappPhone" TEXT;

ALTER TABLE "UserNotificationPreference" ADD COLUMN "whatsappNotifications" BOOLEAN NOT NULL DEFAULT false;
