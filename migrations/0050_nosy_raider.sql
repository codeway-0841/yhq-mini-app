CREATE TABLE "daily_spins" (
	"user_id" text PRIMARY KEY NOT NULL,
	"spin_date" text NOT NULL,
	"reward_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_spins" ADD CONSTRAINT "daily_spins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;