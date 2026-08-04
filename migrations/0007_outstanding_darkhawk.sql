CREATE TABLE "daily_streaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"subject_id" text NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"last_daily_date" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_daily_streak" UNIQUE("user_id","subject_id")
);
--> statement-breakpoint
ALTER TABLE "daily_streaks" ADD CONSTRAINT "daily_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;