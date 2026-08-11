CREATE TABLE "daily_rewards" (
	"user_id" text PRIMARY KEY NOT NULL,
	"last_claim_date" text,
	"streak" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_daily_rewards_streak_nonneg" CHECK ("daily_rewards"."streak" >= 0),
	CONSTRAINT "chk_daily_rewards_date_fmt" CHECK ("daily_rewards"."last_claim_date" IS NULL OR "daily_rewards"."last_claim_date" ~ '^\d{4}-\d{2}-\d{2}$')
);
--> statement-breakpoint
CREATE TABLE "shop_items" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name_uz" text NOT NULL,
	"name_ru" text NOT NULL,
	"image" text NOT NULL,
	"price" integer NOT NULL,
	"category" text DEFAULT 'all' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_shop_items_type" CHECK ("shop_items"."type" IN ('avatar', 'merch', 'badge')),
	CONSTRAINT "chk_shop_items_price_positive" CHECK ("shop_items"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE "token_balances" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_token_balance_nonneg" CHECK ("token_balances"."balance" >= 0),
	CONSTRAINT "chk_token_total_earned_nonneg" CHECK ("token_balances"."total_earned" >= 0)
);
--> statement-breakpoint
CREATE TABLE "token_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title_uz" text NOT NULL,
	"title_ru" text NOT NULL,
	"reward" integer NOT NULL,
	"total" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chk_token_tasks_reward_positive" CHECK ("token_tasks"."reward" > 0),
	CONSTRAINT "chk_token_tasks_total_positive" CHECK ("token_tasks"."total" > 0)
);
--> statement-breakpoint
CREATE TABLE "token_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"type" text NOT NULL,
	"ref_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_token_tx_type" CHECK ("token_transactions"."type" IN ('task', 'daily', 'purchase', 'level_up', 'refund', 'package'))
);
--> statement-breakpoint
CREATE TABLE "user_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"price" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_purchase" UNIQUE("user_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "user_task_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"task_id" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_task" UNIQUE("user_id","task_id"),
	CONSTRAINT "chk_user_task_progress_nonneg" CHECK ("user_task_progress"."progress" >= 0)
);
--> statement-breakpoint
ALTER TABLE "daily_rewards" ADD CONSTRAINT "daily_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "token_balances" ADD CONSTRAINT "token_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_purchases" ADD CONSTRAINT "user_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_purchases" ADD CONSTRAINT "user_purchases_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_task_progress" ADD CONSTRAINT "user_task_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_task_progress" ADD CONSTRAINT "user_task_progress_task_id_token_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."token_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_shop_items_type" ON "shop_items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_shop_items_type_category" ON "shop_items" USING btree ("type","category");--> statement-breakpoint
CREATE INDEX "idx_token_tx_user_created" ON "token_transactions" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_token_tx_type" ON "token_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_user_purchases_user" ON "user_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_task_progress_user" ON "user_task_progress" USING btree ("user_id");