ALTER TABLE "referrals" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "referrals" ADD COLUMN "rewarded_at" timestamp;--> statement-breakpoint
-- Backfill: eskirgan qatorlar (v1 oqimi) mukofotni allaqachon OLGAN —
-- qayta mukofotlanmasligi uchun 'rewarded' deb belgilanadi.
UPDATE "referrals" SET "status" = 'rewarded', "rewarded_at" = "created_at";