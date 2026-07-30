CREATE TYPE "public"."font_size" AS ENUM('small', 'medium', 'large');--> statement-breakpoint
CREATE TYPE "public"."font_style" AS ENUM('default', 'serif', 'mono');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('uz', 'ru');--> statement-breakpoint
CREATE TYPE "public"."tariff" AS ENUM('free', 'premium');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('dark', 'light');--> statement-breakpoint
CREATE TABLE "progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"total_correct" integer DEFAULT 0 NOT NULL,
	"total_wrong" integer DEFAULT 0 NOT NULL,
	"total_answered" integer DEFAULT 0 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"wrong_by_ticket" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "progress_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "saved_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"question_id" integer NOT NULL,
	CONSTRAINT "uq_saved" UNIQUE("user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"auto_next_correct" boolean DEFAULT true NOT NULL,
	"auto_next_wrong" boolean DEFAULT false NOT NULL,
	"no_animation" boolean DEFAULT false NOT NULL,
	"shuffle_options" boolean DEFAULT false NOT NULL,
	"font_size" "font_size" DEFAULT 'medium' NOT NULL,
	"font_style" "font_style" DEFAULT 'default' NOT NULL,
	"language" "language" DEFAULT 'uz' NOT NULL,
	"theme" "theme" DEFAULT 'dark' NOT NULL,
	"offline_mode" boolean DEFAULT false NOT NULL,
	CONSTRAINT "settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text DEFAULT '',
	"username" text DEFAULT '',
	"photo_url" text DEFAULT '',
	"tariff" "tariff" DEFAULT 'free' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_questions" ADD CONSTRAINT "saved_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;