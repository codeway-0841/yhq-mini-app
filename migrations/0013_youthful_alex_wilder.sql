CREATE TABLE "question_explanations" (
	"question_id" integer PRIMARY KEY NOT NULL,
	"explanation_uz" text NOT NULL,
	"explanation_ru" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_explanations" ADD CONSTRAINT "question_explanations_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;