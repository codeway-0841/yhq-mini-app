CREATE TABLE "duel_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"user_id" text NOT NULL,
	"opponent_id" text,
	"result" text NOT NULL,
	"self_score" integer DEFAULT 0 NOT NULL,
	"opp_score" integer DEFAULT 0 NOT NULL,
	"forfeit" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_duel_result_match_user" UNIQUE("match_id","user_id"),
	CONSTRAINT "chk_duel_result_kind" CHECK ("duel_results"."result" IN ('win','lose','draw')),
	CONSTRAINT "chk_duel_result_scores" CHECK ("duel_results"."self_score" >= 0 AND "duel_results"."opp_score" >= 0)
);
--> statement-breakpoint
ALTER TABLE "duel_results" ADD CONSTRAINT "duel_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_duel_result_created" ON "duel_results" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_duel_result_user_created" ON "duel_results" USING btree ("user_id","created_at");