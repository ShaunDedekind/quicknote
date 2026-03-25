-- Add index on Note.userId for efficient per-user note fetching
CREATE INDEX IF NOT EXISTS "Note_userId_idx" ON "Note"("userId");

-- Composite index for the common query: notes for a user filtered by status
CREATE INDEX IF NOT EXISTS "Note_userId_status_idx" ON "Note"("userId", "status");
