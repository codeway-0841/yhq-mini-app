-- Custom migration: MULTI-PROVIDER AUTH
-- users.id bigint -> text (Google/telefon kabi raqamli-olmaydigan provider id'lari
-- bigint'ga sig'maydi) + auth_identities / sessions / link_codes jadvallari.
-- Old server kodi ham ishlashda davom etadi: Postgres int8->text implicit cast.
--> statement-breakpoint
-- 1) users(id)'ga ishora qiluvchi FK constraint'larni vaqtincha tashlash
ALTER TABLE "answer_tokens"    DROP CONSTRAINT "answer_tokens_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "payments"         DROP CONSTRAINT "payments_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "progress"         DROP CONSTRAINT "progress_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "settings"         DROP CONSTRAINT "settings_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "saved_questions"  DROP CONSTRAINT "saved_questions_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "referrals"        DROP CONSTRAINT "referrals_referrer_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "referrals"        DROP CONSTRAINT "referrals_referee_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP CONSTRAINT "analytics_events_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "daily_streaks"    DROP CONSTRAINT "daily_streaks_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "daily_records"    DROP CONSTRAINT "daily_records_user_id_users_id_fk";--> statement-breakpoint

-- 2) Type almashtirish — ma'lumot saqlanadi (USING ::text)
ALTER TABLE "users"            ALTER COLUMN "id" TYPE text USING "id"::text;--> statement-breakpoint
ALTER TABLE "answer_tokens"    ALTER COLUMN "user_id" TYPE text USING "user_id"::text;--> statement-breakpoint
ALTER TABLE "payments"         ALTER COLUMN "user_id" TYPE text USING "user_id"::text;--> statement-breakpoint
ALTER TABLE "progress"         ALTER COLUMN "user_id" TYPE text USING "user_id"::text;--> statement-breakpoint
ALTER TABLE "settings"         ALTER COLUMN "user_id" TYPE text USING "user_id"::text;--> statement-breakpoint
ALTER TABLE "saved_questions"  ALTER COLUMN "user_id" TYPE text USING "user_id"::text;--> statement-breakpoint
ALTER TABLE "referrals"        ALTER COLUMN "referrer_id" TYPE text USING "referrer_id"::text;--> statement-breakpoint
ALTER TABLE "referrals"        ALTER COLUMN "referee_id" TYPE text USING "referee_id"::text;--> statement-breakpoint
ALTER TABLE "analytics_events" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;--> statement-breakpoint
ALTER TABLE "daily_streaks"    ALTER COLUMN "user_id" TYPE text USING "user_id"::text;--> statement-breakpoint
ALTER TABLE "daily_records"    ALTER COLUMN "user_id" TYPE text USING "user_id"::text;--> statement-breakpoint
ALTER TABLE "tutor_usage"      ALTER COLUMN "user_id" TYPE text USING "user_id"::text;--> statement-breakpoint

-- 3) FK'larni qayta yaratish (onDelete xatti-harakati o'zgarmagan)
ALTER TABLE "answer_tokens"    ADD CONSTRAINT "answer_tokens_user_id_users_id_fk"    FOREIGN KEY ("user_id")     REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"         ADD CONSTRAINT "payments_user_id_users_id_fk"         FOREIGN KEY ("user_id")     REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress"         ADD CONSTRAINT "progress_user_id_users_id_fk"         FOREIGN KEY ("user_id")     REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings"         ADD CONSTRAINT "settings_user_id_users_id_fk"         FOREIGN KEY ("user_id")     REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_questions"  ADD CONSTRAINT "saved_questions_user_id_users_id_fk"  FOREIGN KEY ("user_id")     REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals"        ADD CONSTRAINT "referrals_referrer_id_users_id_fk"    FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals"        ADD CONSTRAINT "referrals_referee_id_users_id_fk"     FOREIGN KEY ("referee_id")  REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id")     REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_streaks"    ADD CONSTRAINT "daily_streaks_user_id_users_id_fk"    FOREIGN KEY ("user_id")     REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_records"    ADD CONSTRAINT "daily_records_user_id_users_id_fk"    FOREIGN KEY ("user_id")     REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- 4) Yangi auth jadvallari
CREATE TABLE "auth_identities" (
	"provider" text NOT NULL,
	"provider_uid" text NOT NULL,
	"user_id" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_identities_provider_provider_uid_pk" PRIMARY KEY("provider","provider_uid"),
	CONSTRAINT "chk_auth_identities_provider" CHECK ("provider" IN ('telegram','phone'))
);--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_auth_identities_user" ON "auth_identities" USING btree ("user_id");--> statement-breakpoint

CREATE TABLE "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_sessions_provider" CHECK ("provider" IN ('telegram','phone'))
);--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "sessions" USING btree ("expires_at");--> statement-breakpoint

CREATE TABLE "link_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "link_codes" ADD CONSTRAINT "link_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_link_codes_user" ON "link_codes" USING btree ("user_id");--> statement-breakpoint

-- 5) Mavjud Telegram userlarni identity'ga seed qilish (idempotent)
INSERT INTO "auth_identities" ("provider", "provider_uid", "user_id")
SELECT 'telegram', "id", "id" FROM "users"
ON CONFLICT ON CONSTRAINT "auth_identities_provider_provider_uid_pk" DO NOTHING;
