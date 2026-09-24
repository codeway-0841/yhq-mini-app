ALTER TABLE "settings" ALTER COLUMN "auto_next_wrong" SET DEFAULT true;
--> statement-breakpoint
-- 2026-09-24 product: xato javobdan keyin avto-o'tish DEFAULT ON.
-- Mavjud qatorlar ham bir marta true'ga o'tadi (ataylab o'chirgan user
-- Sozlamalardan qayta o'chiradi — PATCH /settings sync saqlanadi).
UPDATE "settings" SET "auto_next_wrong" = true WHERE "auto_next_wrong" = false;