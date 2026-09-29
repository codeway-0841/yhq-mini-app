CREATE TABLE "live_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_live_messages_len" CHECK (char_length("live_messages"."body") BETWEEN 1 AND 500)
);
--> statement-breakpoint
CREATE TABLE "live_participants" (
	"room_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'student' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "live_participants_room_id_user_id_pk" PRIMARY KEY("room_id","user_id"),
	CONSTRAINT "chk_live_participants_role" CHECK ("live_participants"."role" IN ('teacher','student')),
	CONSTRAINT "chk_live_participants_duration" CHECK ("live_participants"."duration_sec" >= 0)
);
--> statement-breakpoint
CREATE TABLE "live_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"teacher_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"ended_at" timestamp,
	"room_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "live_rooms_room_name_unique" UNIQUE("room_name"),
	CONSTRAINT "chk_live_rooms_status" CHECK ("live_rooms"."status" IN ('scheduled','live','ended')),
	CONSTRAINT "chk_live_rooms_title_len" CHECK (char_length("live_rooms"."title") BETWEEN 3 AND 120)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_teacher" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "live_messages" ADD CONSTRAINT "live_messages_room_id_live_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."live_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_messages" ADD CONSTRAINT "live_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "live_participants" ADD CONSTRAINT "live_participants_room_id_live_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."live_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_participants" ADD CONSTRAINT "live_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "live_rooms" ADD CONSTRAINT "live_rooms_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_live_messages_room_time" ON "live_messages" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_live_participants_room" ON "live_participants" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "idx_live_rooms_status_time" ON "live_rooms" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_live_rooms_subject" ON "live_rooms" USING btree ("subject_id","status");--> statement-breakpoint
CREATE INDEX "idx_live_rooms_teacher" ON "live_rooms" USING btree ("teacher_id");