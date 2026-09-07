CREATE TABLE "test_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"position" integer NOT NULL,
	"question_id" integer NOT NULL,
	"selected_option_id" text NOT NULL,
	"correct" boolean NOT NULL,
	"client_token" text NOT NULL,
	"result_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"elapsed_ms_client" integer,
	"elapsed_ms_server" integer,
	"answered_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_test_attempt_position" UNIQUE("session_id","position"),
	CONSTRAINT "uq_test_attempt_token" UNIQUE("user_id","client_token"),
	CONSTRAINT "chk_test_attempt_position" CHECK ("test_attempts"."position" >= 0),
	CONSTRAINT "chk_test_attempt_elapsed" CHECK (
    ("test_attempts"."elapsed_ms_client" IS NULL OR ("test_attempts"."elapsed_ms_client" >= 0 AND "test_attempts"."elapsed_ms_client" <= 600000))
    AND ("test_attempts"."elapsed_ms_server" IS NULL OR "test_attempts"."elapsed_ms_server" >= 0)
  )
);
--> statement-breakpoint
CREATE TABLE "test_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"bank_id" text NOT NULL,
	"mode" text NOT NULL,
	"selector" jsonb NOT NULL,
	"selection_seed" text NOT NULL,
	"bank_version" integer DEFAULT 1 NOT NULL,
	"question_ids" jsonb NOT NULL,
	"total_questions" integer NOT NULL,
	"issued_through" integer DEFAULT -1 NOT NULL,
	"answered_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_test_sessions_status" CHECK ("test_sessions"."status" IN ('active', 'completed', 'abandoned', 'expired')),
	CONSTRAINT "chk_test_sessions_counts" CHECK (
    "test_sessions"."total_questions" > 0
    AND "test_sessions"."issued_through" >= -1
    AND "test_sessions"."issued_through" < "test_sessions"."total_questions"
    AND "test_sessions"."answered_count" >= 0
    AND "test_sessions"."answered_count" <= "test_sessions"."total_questions"
  )
);
--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_session_id_test_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."test_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_bank_id_question_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."question_banks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_test_attempts_session" ON "test_attempts" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "idx_test_attempts_created" ON "test_attempts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_test_sessions_user_active" ON "test_sessions" USING btree ("user_id","status","last_active_at");--> statement-breakpoint
CREATE INDEX "idx_test_sessions_expires" ON "test_sessions" USING btree ("expires_at");