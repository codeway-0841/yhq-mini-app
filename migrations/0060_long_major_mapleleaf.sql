ALTER TABLE "test_attempts" ALTER COLUMN "answered_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "test_attempts" ALTER COLUMN "answered_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "test_attempts" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "test_attempts" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "test_sessions" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "test_sessions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "test_sessions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "test_sessions" ALTER COLUMN "last_active_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "test_sessions" ALTER COLUMN "last_active_at" SET DEFAULT now();