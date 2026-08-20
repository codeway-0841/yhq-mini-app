CREATE TABLE "merch_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"note" text,
	"price_paid" integer NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_merch_orders_price_positive" CHECK ("merch_orders"."price_paid" > 0)
);
--> statement-breakpoint
ALTER TABLE "merch_orders" ADD CONSTRAINT "merch_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_merch_orders_user" ON "merch_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_merch_orders_status" ON "merch_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_merch_orders_item" ON "merch_orders" USING btree ("item_id");