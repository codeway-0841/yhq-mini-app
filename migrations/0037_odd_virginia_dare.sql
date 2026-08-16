CREATE TABLE "payment_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"user_id" text NOT NULL,
	"plan" text NOT NULL,
	"amount_uzs" integer NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_trans_id" text,
	"raw_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_orders_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "tournament_prizes" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_key" text NOT NULL,
	"user_id" text NOT NULL,
	"rank" integer NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"league" text DEFAULT 'bronze' NOT NULL,
	"prize_days" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_tournament_prize_period_rank" UNIQUE("period_key","rank")
);
--> statement-breakpoint
ALTER TABLE "progress" ADD COLUMN "correct_questions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Backfill: ilgari TO'G'RI javob berilgan deb hisoblanadigan savollar —
-- solved_questions ichida hozirda yechilmagan xato tikketi YO'Q elementlar.
-- (solved_questions har qanday javobda qo'shiladi; wrong_by_ticket'dan
-- tozalanishi = oxirgi javob to'g'ri bo'lgan.)
UPDATE "progress" SET "correct_questions" = (
	SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
	FROM jsonb_array_elements_text(COALESCE("solved_questions", '[]'::jsonb)) AS elem
	WHERE NOT (COALESCE("wrong_by_ticket", '{}'::jsonb) ? elem)
);--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tournament_prizes" ADD CONSTRAINT "tournament_prizes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_payment_orders_user" ON "payment_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_orders_order_id" ON "payment_orders" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_tournament_prizes_user" ON "tournament_prizes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tournament_prizes_period" ON "tournament_prizes" USING btree ("period_key");