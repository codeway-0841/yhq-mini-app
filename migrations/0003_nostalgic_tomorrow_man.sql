CREATE TABLE "topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_uz" text NOT NULL,
	"name_ru" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "topic_id" integer;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;