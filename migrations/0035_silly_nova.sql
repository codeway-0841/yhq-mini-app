CREATE TABLE "card_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" text DEFAULT 'yhq' NOT NULL,
	"question_id" integer NOT NULL,
	"ef" real DEFAULT 2.5 NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_card_progress" UNIQUE("user_id","subject_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "card_progress" ADD CONSTRAINT "card_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "card_progress" ADD CONSTRAINT "card_progress_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_card_user_subject" ON "card_progress" USING btree ("user_id","subject_id");