-- Delete a User by email and cascade to Account + Session rows.
-- Note rows are NOT deleted — userId is set to NULL (SET NULL on delete).
--
-- Usage:
--   npx prisma db execute --file prisma/delete-user.sql --schema prisma/schema.prisma
--
-- Replace the email below with your actual email address before running.

DELETE FROM "User"
WHERE email = 'YOUR_EMAIL_HERE';
