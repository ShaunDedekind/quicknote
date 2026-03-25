-- Add pinnedToToday flag to Note
-- A note with pinnedToToday = true always appears in the Today group
-- regardless of its dueDate, enabling drag-to-pull-forward from future day groups.
ALTER TABLE "Note" ADD COLUMN "pinnedToToday" BOOLEAN NOT NULL DEFAULT false;
