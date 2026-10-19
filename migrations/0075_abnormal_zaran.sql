ALTER TABLE "darslik_checks" ADD COLUMN "content_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "darslik_checks" ADD COLUMN "source" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "darslik_checks" ADD COLUMN "generated_at" timestamp DEFAULT now() NOT NULL;