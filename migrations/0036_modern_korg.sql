CREATE TABLE "promo_code_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"promo_code_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"redeemed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_promo_redemption" UNIQUE("promo_code_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" text DEFAULT 'premium_days' NOT NULL,
	"value" integer NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_promo_code" UNIQUE("code"),
	CONSTRAINT "chk_promo_value_positive" CHECK ("promo_codes"."value" > 0),
	CONSTRAINT "chk_promo_used_count_nonnegative" CHECK ("promo_codes"."used_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "promo_code_redemptions" ADD CONSTRAINT "promo_code_redemptions_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_code_redemptions" ADD CONSTRAINT "promo_code_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_promo_redemptions_user" ON "promo_code_redemptions" USING btree ("user_id");