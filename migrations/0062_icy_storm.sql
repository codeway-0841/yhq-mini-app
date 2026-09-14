CREATE TABLE "saved_graphs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"payload" jsonb NOT NULL,
	"share_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_saved_graphs_share" UNIQUE("share_code"),
	CONSTRAINT "chk_saved_graphs_title_len" CHECK (char_length("saved_graphs"."title") <= 60)
);
--> statement-breakpoint
ALTER TABLE "saved_graphs" ADD CONSTRAINT "saved_graphs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_saved_graphs_user_time" ON "saved_graphs" USING btree ("user_id","updated_at" DESC NULLS LAST);