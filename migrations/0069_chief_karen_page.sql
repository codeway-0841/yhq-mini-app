ALTER TABLE "live_recordings" DROP CONSTRAINT "chk_live_recordings_status";--> statement-breakpoint
ALTER TABLE "live_rooms" DROP CONSTRAINT "chk_live_rooms_status";--> statement-breakpoint
ALTER TABLE "live_recordings" ADD CONSTRAINT "chk_live_recordings_status" CHECK ("live_recordings"."status" IN ('starting','started','stopping','ready','failed'));--> statement-breakpoint
ALTER TABLE "live_rooms" ADD CONSTRAINT "chk_live_rooms_status" CHECK ("live_rooms"."status" IN ('scheduled','live','ending','ended'));--> statement-breakpoint
-- Bitta xonada bitta faol yozuv (starting/started/stopping) — parallel start race strukturaviy himoya
-- (drizzle partial index'ni qo'llamaydi — qo'lda, merch uq_merch_active pattern'i kabi).
CREATE UNIQUE INDEX "uq_live_recording_active" ON "live_recordings" ("room_id") WHERE "status" IN ('starting','started','stopping');