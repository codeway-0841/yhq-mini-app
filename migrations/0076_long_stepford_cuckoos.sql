CREATE TABLE "darslik_check_xp" (
	"user_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"xp" integer NOT NULL,
	"awarded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "darslik_check_xp_user_id_topic_id_exercise_id_pk" PRIMARY KEY("user_id","topic_id","exercise_id"),
	CONSTRAINT "chk_darslik_check_xp_pos" CHECK ("darslik_check_xp"."xp" > 0)
);
--> statement-breakpoint
ALTER TABLE "daily_streaks" ADD COLUMN "charges" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "darslik_check_xp" ADD CONSTRAINT "darslik_check_xp_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "daily_streaks" ADD CONSTRAINT "chk_daily_streak_charges_range" CHECK ("daily_streaks"."charges" >= 0 AND "daily_streaks"."charges" <= 2);