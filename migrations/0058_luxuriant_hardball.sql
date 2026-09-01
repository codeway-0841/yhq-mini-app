CREATE TABLE "ai_daily_test_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"answers" jsonb NOT NULL,
	"grading" jsonb NOT NULL,
	"score_correct" integer NOT NULL,
	"essay_score" integer DEFAULT 0 NOT NULL,
	"coins_awarded" integer DEFAULT 0 NOT NULL,
	"client_token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ai_attempt_test_user" UNIQUE("test_id","user_id"),
	CONSTRAINT "uq_ai_attempt_token" UNIQUE("user_id","client_token"),
	CONSTRAINT "chk_ai_attempt_scores" CHECK ("ai_daily_test_attempts"."score_correct" >= 0 AND "ai_daily_test_attempts"."essay_score" BETWEEN 0 AND 10 AND "ai_daily_test_attempts"."coins_awarded" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ai_daily_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"date" text NOT NULL,
	"slot" integer NOT NULL,
	"title" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ai_daily_test" UNIQUE("subject_id","date","slot"),
	CONSTRAINT "chk_ai_daily_test_slot" CHECK ("ai_daily_tests"."slot" IN (1, 2)),
	CONSTRAINT "chk_ai_daily_test_date_fmt" CHECK ("ai_daily_tests"."date" ~ '^\d{4}-\d{2}-\d{2}$')
);
--> statement-breakpoint
ALTER TABLE "ai_daily_test_attempts" ADD CONSTRAINT "ai_daily_test_attempts_test_id_ai_daily_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."ai_daily_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_daily_test_attempts" ADD CONSTRAINT "ai_daily_test_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_ai_attempt_user" ON "ai_daily_test_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_daily_tests_date" ON "ai_daily_tests" USING btree ("subject_id","date");