CREATE TABLE IF NOT EXISTS "telegram_login_pending" (
	"tg_user_id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
