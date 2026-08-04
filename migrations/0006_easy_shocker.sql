CREATE TABLE "daily_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"date" text NOT NULL,
	"subject_id" text NOT NULL,
	"answered" integer DEFAULT 0 NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_daily_record" UNIQUE("user_id","date","subject_id")
);
--> statement-breakpoint
ALTER TABLE "progress" ADD COLUMN "daily_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "progress" ADD COLUMN "last_daily_date" text;--> statement-breakpoint
ALTER TABLE "daily_records" ADD CONSTRAINT "daily_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_daily_user_date" ON "daily_records" USING btree ("user_id","date");