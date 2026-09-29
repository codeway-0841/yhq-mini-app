CREATE TABLE "live_hand_raises" (
	"room_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "live_hand_raises_room_id_user_id_pk" PRIMARY KEY("room_id","user_id"),
	CONSTRAINT "chk_live_hands_status" CHECK ("live_hand_raises"."status" IN ('pending','approved','rejected'))
);
--> statement-breakpoint
ALTER TABLE "live_participants" ADD COLUMN "can_speak" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "live_hand_raises" ADD CONSTRAINT "live_hand_raises_room_id_live_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."live_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_hand_raises" ADD CONSTRAINT "live_hand_raises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_live_hands_room_status" ON "live_hand_raises" USING btree ("room_id","status");