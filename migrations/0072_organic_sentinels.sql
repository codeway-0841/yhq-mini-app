-- Old scheduled_at values were stored as naive UTC timestamps. Interpret them
-- explicitly as UTC so deploy environment timezone cannot shift existing lessons.
-- Rollback (if needed): ALTER TABLE "live_rooms" ALTER COLUMN "scheduled_at"
--   SET DATA TYPE timestamp USING "scheduled_at" AT TIME ZONE 'UTC';
ALTER TABLE "live_rooms" ALTER COLUMN "scheduled_at" SET DATA TYPE timestamp with time zone USING "scheduled_at" AT TIME ZONE 'UTC';
