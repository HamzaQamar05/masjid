ALTER TABLE "User" ADD COLUMN "bannerUrl" TEXT;

ALTER TABLE "Organization" ADD COLUMN "prayerNotes" TEXT;
ALTER TABLE "Organization" ADD COLUMN "classes" JSONB;

ALTER TABLE "Opportunity" ADD COLUMN "requirements" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN "workType" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN "deadline" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN "applicationQuestions" JSONB;

ALTER TABLE "VolunteerApplication" ADD COLUMN "applicantName" TEXT;
ALTER TABLE "VolunteerApplication" ADD COLUMN "applicantEmail" TEXT;
ALTER TABLE "VolunteerApplication" ADD COLUMN "answers" JSONB;
