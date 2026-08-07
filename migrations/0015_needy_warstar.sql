CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_payment_charge_id" text NOT NULL,
	"provider_payment_charge_id" text NOT NULL,
	"user_id" bigint NOT NULL,
	"plan" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"payload" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"raw_update" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_telegram_payment_charge_id_unique" UNIQUE("telegram_payment_charge_id")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payments_user_created" ON "payments" USING btree ("user_id","created_at");