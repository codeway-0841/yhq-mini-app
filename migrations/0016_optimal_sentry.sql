ALTER TABLE "users" ADD COLUMN "trial_granted_at" timestamp;
--> statement-breakpoint
-- Old semantics used premium_until as the one-time trial marker. Preserve that
-- behavior during migration so existing rewarded/subscribed users cannot claim
-- an extra trial after deployment.
UPDATE "users"
SET "trial_granted_at" = COALESCE("updated_at", now())
WHERE "premium_until" IS NOT NULL;