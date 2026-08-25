-- Coin iqtisodi 2× ga ko'chirildi (narxlar, mukofotlar, javob mint'i).
--
-- Narxlar ikki barobar oshgani uchun MAVJUD balanslar ham ikki barobar
-- oshiriladi — aks holda hamma foydalanuvchining tangasi bir kechada
-- yarmiga arzonlab qolardi (500c tema endi 1000c).
--
-- Ledger TAHRIRLANMAYDI: eski qatorlar audit izi bo'lib turibdi. Buning
-- o'rniga qo'shilgan miqdor ochiq 'admin' qatori sifatida yoziladi, ya'ni
-- balans = delta'lar yig'indisi invarianti buzilmaydi.
--
-- BITTA statement (CTE): ledger yozuvi va balans yangilanishi bir xil
-- snapshot'da bajariladi, ya'ni oralarida coin ishlab olish mumkin emas.
-- UPDATE faqat ledger qatori AYNAN SHU ijroda yozilgan foydalanuvchilarga
-- tegadi (RETURNING) — migratsiya qayta ishga tushsa ON CONFLICT DO NOTHING
-- hech nima qaytarmaydi va balans ikkinchi marta oshmaydi.
WITH marked AS (
  INSERT INTO "coin_transactions" ("user_id", "delta", "reason", "ref_id")
  SELECT "user_id", "balance", 'admin', 'economy-2x'
  FROM "user_coins"
  WHERE "balance" > 0
  ON CONFLICT ("user_id", "reason", "ref_id") DO NOTHING
  RETURNING "user_id"
)
UPDATE "user_coins"
SET "balance" = "balance" * 2, "updated_at" = now()
WHERE "user_id" IN (SELECT "user_id" FROM marked);
