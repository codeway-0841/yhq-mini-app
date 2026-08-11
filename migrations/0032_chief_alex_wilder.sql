CREATE TABLE "league_rollover_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period_key" text NOT NULL,
	"from_league" text NOT NULL,
	"to_league" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_rollover_user_period" UNIQUE("user_id","period_key")
);
--> statement-breakpoint
ALTER TABLE "league_rollover_log" ADD CONSTRAINT "league_rollover_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_rollover_period" ON "league_rollover_log" USING btree ("period_key");