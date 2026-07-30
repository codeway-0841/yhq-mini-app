CREATE TABLE "questions" (
	"id" integer PRIMARY KEY NOT NULL,
	"question_uz" text NOT NULL,
	"question_ru" text NOT NULL,
	"options_uz" jsonb NOT NULL,
	"options_ru" jsonb NOT NULL,
	"correct_answer" text NOT NULL,
	"image" text
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "saved_questions" ADD CONSTRAINT "saved_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;