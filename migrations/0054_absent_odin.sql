CREATE TABLE "daily_limits" (
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"coins_earned" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_limits_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "chk_daily_limits_nonnegative" CHECK ("daily_limits"."xp_earned" >= 0 AND "daily_limits"."coins_earned" >= 0),
	CONSTRAINT "chk_daily_limits_date_fmt" CHECK ("daily_limits"."date" ~ '^\d{4}-\d{2}-\d{2}$')
);
--> statement-breakpoint
ALTER TABLE "progress" DROP CONSTRAINT "chk_progress_nonnegative";--> statement-breakpoint
ALTER TABLE "progress" ADD COLUMN "xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_limits" ADD CONSTRAINT "daily_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "chk_progress_nonnegative" CHECK (
    "progress"."total_correct" >= 0 AND "progress"."total_wrong" >= 0 AND "progress"."total_answered" >= 0
    AND "progress"."streak" >= 0 AND "progress"."octagon_wins" >= 0 AND "progress"."xp" >= 0
  );