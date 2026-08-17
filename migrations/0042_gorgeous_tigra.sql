CREATE TABLE "tg_broadcast_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"broadcast_id" integer NOT NULL,
	"tg_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"claimed_at" timestamp,
	"error" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tg_broadcasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"segment" text NOT NULL,
	"message" text NOT NULL,
	"image_url" text,
	"button_text" text,
	"button_url" text,
	"photo_file_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"target_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"blocked_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "tg_broadcast_recipients" ADD CONSTRAINT "tg_broadcast_recipients_broadcast_id_tg_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."tg_broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tg_recipients_broadcast" ON "tg_broadcast_recipients" USING btree ("broadcast_id","status");