-- M10: sessions.token DB'da PLAINTEXT edi — endi FAQAT sha256 hash saqlanadi
-- (auth.repository create/resolve/delete'da hashlaydi). Mavjud sessiyalarni
-- joyida hash'laymiz — user'lar deploy'da logout bo'lib qolmaydi.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
UPDATE "sessions" SET "token" = encode(digest("token", 'sha256'), 'hex');
