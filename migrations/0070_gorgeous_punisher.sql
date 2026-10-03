CREATE TABLE "review_helpful" (
	"review_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_helpful_review_id_user_id_pk" PRIMARY KEY("review_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" text,
	"rating" integer NOT NULL,
	"title" text NOT NULL,
	"comment" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_reviews_rating_range" CHECK ("reviews"."rating" >= 1 AND "reviews"."rating" <= 5),
	CONSTRAINT "chk_reviews_title_len" CHECK (char_length("reviews"."title") BETWEEN 1 AND 100),
	CONSTRAINT "chk_reviews_comment_len" CHECK (char_length("reviews"."comment") BETWEEN 3 AND 1000),
	CONSTRAINT "chk_reviews_helpful_nonneg" CHECK ("reviews"."helpful_count" >= 0),
	CONSTRAINT "chk_reviews_status_valid" CHECK ("reviews"."status" IN ('pending','approved','rejected'))
);
--> statement-breakpoint
ALTER TABLE "review_helpful" ADD CONSTRAINT "review_helpful_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_helpful" ADD CONSTRAINT "review_helpful_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_reviews_user" ON "reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_status_created" ON "reviews" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_reviews_subject" ON "reviews" USING btree ("subject_id");