ALTER TABLE "telegram_login_codes" ADD COLUMN "tg_user_id" text;--> statement-breakpoint
ALTER TABLE "telegram_login_codes" ADD COLUMN "tg_phone" text;--> statement-breakpoint
ALTER TABLE "telegram_login_codes" ADD COLUMN "tg_profile" jsonb;--> statement-breakpoint
CREATE INDEX "idx_tg_login_codes_tg_user" ON "telegram_login_codes" USING btree ("tg_user_id");