CREATE TABLE "UserNotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "masjidAnnouncements" BOOLEAN NOT NULL DEFAULT true,
  "eventsFromFollowedMasjids" BOOLEAN NOT NULL DEFAULT true,
  "programsFromFollowedMasjids" BOOLEAN NOT NULL DEFAULT true,
  "jobOpportunities" BOOLEAN NOT NULL DEFAULT true,
  "volunteerOpportunities" BOOLEAN NOT NULL DEFAULT true,
  "prayerTimeReminders" BOOLEAN NOT NULL DEFAULT false,
  "jamaatTimeUpdates" BOOLEAN NOT NULL DEFAULT true,
  "eventReminders" BOOLEAN NOT NULL DEFAULT true,
  "applicationStatusUpdates" BOOLEAN NOT NULL DEFAULT true,
  "messages" BOOLEAN NOT NULL DEFAULT true,
  "nearbyMasjids" BOOLEAN NOT NULL DEFAULT false,
  "nearbyEvents" BOOLEAN NOT NULL DEFAULT false,
  "nearbyVolunteerOpportunities" BOOLEAN NOT NULL DEFAULT false,
  "jobOpportunitySource" TEXT NOT NULL DEFAULT 'followed',
  "volunteerOpportunitySource" TEXT NOT NULL DEFAULT 'followed',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FavoriteMasjid" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FavoriteMasjid_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "notify" BOOLEAN NOT NULL DEFAULT true,
  "saved" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EventSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserNotificationPreference_userId_key" ON "UserNotificationPreference"("userId");
CREATE UNIQUE INDEX "FavoriteMasjid_organizationId_userId_key" ON "FavoriteMasjid"("organizationId", "userId");
CREATE INDEX "FavoriteMasjid_userId_createdAt_idx" ON "FavoriteMasjid"("userId", "createdAt");
CREATE UNIQUE INDEX "EventSubscription_userId_eventId_key" ON "EventSubscription"("userId", "eventId");
CREATE INDEX "EventSubscription_userId_saved_idx" ON "EventSubscription"("userId", "saved");
CREATE INDEX "EventSubscription_eventId_notify_idx" ON "EventSubscription"("eventId", "notify");

ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FavoriteMasjid" ADD CONSTRAINT "FavoriteMasjid_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FavoriteMasjid" ADD CONSTRAINT "FavoriteMasjid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventSubscription" ADD CONSTRAINT "EventSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventSubscription" ADD CONSTRAINT "EventSubscription_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
