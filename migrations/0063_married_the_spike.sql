CREATE TABLE "ai_course_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"lesson_id" text NOT NULL,
	"user_id" text NOT NULL,
	"answers" jsonb NOT NULL,
	"grading" jsonb NOT NULL,
	"score_correct" integer NOT NULL,
	"score_total" integer NOT NULL,
	"coins_awarded" integer DEFAULT 0 NOT NULL,
	"client_token" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ai_course_progress_lesson" UNIQUE("course_id","lesson_id","user_id"),
	CONSTRAINT "uq_ai_course_progress_token" UNIQUE("user_id","client_token"),
	CONSTRAINT "chk_ai_course_progress_scores" CHECK ("ai_course_progress"."score_correct" >= 0 AND "ai_course_progress"."score_total" > 0 AND "ai_course_progress"."score_correct" <= "ai_course_progress"."score_total" AND "ai_course_progress"."coins_awarded" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ai_courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"topic" text NOT NULL,
	"input_kind" text DEFAULT 'topic' NOT NULL,
	"input_ref" text DEFAULT '' NOT NULL,
	"lesson_length" text DEFAULT 'standard' NOT NULL,
	"language" text DEFAULT 'uz' NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_ai_course_input_kind" CHECK ("ai_courses"."input_kind" IN ('topic','link','pdf','chat')),
	CONSTRAINT "chk_ai_course_length" CHECK ("ai_courses"."lesson_length" IN ('short','standard','deep')),
	CONSTRAINT "chk_ai_course_lang" CHECK ("ai_courses"."language" IN ('uz','ru'))
);
--> statement-breakpoint
ALTER TABLE "ai_course_progress" ADD CONSTRAINT "ai_course_progress_course_id_ai_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."ai_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_course_progress" ADD CONSTRAINT "ai_course_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_courses" ADD CONSTRAINT "ai_courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_ai_course_progress_user_course" ON "ai_course_progress" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "idx_ai_courses_user_created" ON "ai_courses" USING btree ("user_id","created_at");