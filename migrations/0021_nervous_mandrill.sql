CREATE TABLE "answer_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answer_tokens" ADD CONSTRAINT "answer_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_answer_tokens_created" ON "answer_tokens" USING btree ("created_at");