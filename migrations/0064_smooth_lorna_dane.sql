CREATE TABLE "images" (
	"id" serial PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"type" text NOT NULL,
	"key" text NOT NULL,
	"public_url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size_bytes" integer NOT NULL,
	"mime" text DEFAULT 'image/webp' NOT NULL,
	"variants" jsonb NOT NULL,
	"ref_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_images_hash_type" UNIQUE("hash","type"),
	CONSTRAINT "chk_images_ref_count" CHECK ("images"."ref_count" >= 0),
	CONSTRAINT "chk_images_dimensions" CHECK ("images"."width" > 0 AND "images"."height" > 0 AND "images"."size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_key" text;--> statement-breakpoint
CREATE INDEX "idx_images_key" ON "images" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_images_type" ON "images" USING btree ("type");