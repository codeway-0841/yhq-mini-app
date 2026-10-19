CREATE TABLE "darslik_checks" (
	"topic_id" text NOT NULL,
	"version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "darslik_checks_topic_id_version_pk" PRIMARY KEY("topic_id","version")
);
--> statement-breakpoint
CREATE TABLE "darslik_mastery" (
	"user_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"version" integer NOT NULL,
	"passed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "darslik_mastery_user_id_topic_id_version_pk" PRIMARY KEY("user_id","topic_id","version")
);
--> statement-breakpoint
ALTER TABLE "darslik_mastery" ADD CONSTRAINT "darslik_mastery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;