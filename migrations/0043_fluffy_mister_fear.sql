CREATE TABLE "progress_questions" (
	"user_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"question_id" integer NOT NULL,
	"correct" boolean DEFAULT false NOT NULL,
	"answered_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "progress_questions_user_id_subject_id_question_id_pk" PRIMARY KEY("user_id","subject_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "progress_questions" ADD CONSTRAINT "progress_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_progress_questions_user" ON "progress_questions" USING btree ("user_id","subject_id");