CREATE TABLE "boss_battles" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_key" text NOT NULL,
	"boss_id" text NOT NULL,
	"hp_total" integer NOT NULL,
	"hp_left" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"rewards_distributed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_boss_period" UNIQUE("period_key")
);
--> statement-breakpoint
CREATE TABLE "boss_damage" (
	"boss_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"damage" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "boss_damage_boss_id_user_id_pk" PRIMARY KEY("boss_id","user_id"),
	CONSTRAINT "chk_boss_damage_nonnegative" CHECK ("boss_damage"."damage" >= 0)
);
--> statement-breakpoint
ALTER TABLE "boss_damage" ADD CONSTRAINT "boss_damage_boss_id_boss_battles_id_fk" FOREIGN KEY ("boss_id") REFERENCES "public"."boss_battles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boss_damage" ADD CONSTRAINT "boss_damage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;