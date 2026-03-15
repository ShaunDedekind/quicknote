-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "calendarWorthy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suggestedAttendees" TEXT,
ADD COLUMN     "suggestedDuration" INTEGER,
ADD COLUMN     "suggestedEventTitle" TEXT;
