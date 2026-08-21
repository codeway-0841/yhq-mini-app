-- 1 user + 1 item = maksimal 1 FAOL merch buyurtma (cancelled qayta olishga ruxsat beradi).
-- Claim-first anti-race invariantsi: parallel buyurtmalarda faqat biri INSERT'dan o'tadi
-- (PK/unique insertion lock), ikkinchisi ON CONFLICT DO NOTHING bilan so'ndiriladi —
-- debit faqat claim g'olibiga tegishli (double-charge imkonsiz).
CREATE UNIQUE INDEX "uq_merch_active_user_item" ON "merch_orders" ("user_id", "item_id") WHERE status <> 'cancelled';--> statement-breakpoint
