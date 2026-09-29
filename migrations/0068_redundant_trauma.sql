CREATE TABLE "live_recordings" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"egress_id" text NOT NULL,
	"r2_key" text,
	"status" text DEFAULT 'started' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_live_recording_egress" UNIQUE("egress_id"),
	CONSTRAINT "chk_live_recordings_status" CHECK ("live_recordings"."status" IN ('started','ready','failed'))
);
--> statement-breakpoint
ALTER TABLE "live_recordings" ADD CONSTRAINT "live_recordings_room_id_live_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."live_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_live_recordings_room" ON "live_recordings" USING btree ("room_id");