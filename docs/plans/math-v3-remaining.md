# Matematika v3 — qolgan ishlar (keyingi sessiya uchun)

Oxirgi holat (2026-09-18): gate ✅ yashil, audit `PASS_WITH_REVIEW` (0 blocking, ~882 placeholder), 29 errata, 64 python + 116 vitest yashil. Push QILINMAGAN.

## 1. Golden fixture rebaseline (eng katta qolgani)
- `tests/fixtures/math-print-golden.fixture.ts` dagi ~35 yozuv ESKI xato matnni kutmoqda.
- Qoida: faqat crop/manba bilan TASDIQLANGAN yangi matnni yozish. Ko'r-ko'rona yangilash TAQIQLANADI.
- Tayyor crop'lar: `tmp/pdfs/math-v3/golden-crops/`, `tmp/pdfs/math-v3/source-crops/`, `tmp/pdfs/math-v3/spotcheck*/`
- Tekshiruv: `npx tsx tmp/pdfs/math-v3/reports/golden-v3.ts` → 80/80 bo'lishi shart.
- E'tibor: `tmp/golden-fail.txt` — hozirgi failing ro'yxat.

## 2. To'liq tekshiruvlar
- `python3 -m unittest discover -s tests/python` (hozir 64/64)
- `npx vitest run tests/unit` (to'liq, faqat math emas!)
- `npx tsc -p tsconfig.json --noEmit` (wonder-studio xatolari BOSHQA sessiyaniki — tegma!)
- `npx tsc -p tsconfig.server.json --noEmit`
- `npm run build`

## 3. Qoldiq placeholderlar (~460 savol)
- Ro'yxat: `content-banks/matematika/v3/review-queue.json`
- Usul: crop → matematika+kalit bilan tasdiq → `source-errata.json` (`confirmed` + reason) — 29 ta namuna bor.
- Kalit tekshirish: `sqlite3 "D:/Matematika Test Print/NatijaDB.db"` → `KalitAl/KalitGeo/KalitAlTrigon/KalitAlGeo/KalitKombi`, format `1.B 2.C...`

## 4. Test bazaga import (prodga TEGMA!)
- `TEST_DATABASE_URL` test bazaga ishora qilishini TEKSHIR (prod emas!).
- Eski math o'chirish: test DB da `DELETE FROM questions WHERE bank_id='math_db'` + topics tozalash (oldin count backup!).
- Import: `DATABASE_URL="$TEST_DATABASE_URL" npx tsx scripts/import-math-bank.ts`
- Tekshir: 11040 savol, 368 mavzu, externalId'lar bir xil.

## 5. Promotion (faqat user "ko'chir" deganda)
- `content-banks/matematika/v3/math-print.json` → `content-banks/matematika/math-print.json`
- `question_banks.content_version` bump, kesh invalidatsiya.
- Determinism: ikki run byte-identical bo'lishi shart (oldin shunday edi).

## Chegaralar
- Boshqa sessiya fayllariga TEGMA: `app.html`, `ai-courses/*`, `wonder-studio/*`, `avtotest*`, `ModesPage`, `index.css`, `tailwind.config`.
- Bizning scope: `scripts/math_pdf/*`, `scripts/extract-math-print-v3.py`, `scripts/audit-math-print-v3.ts`, `scripts/math_formula_builder.py`, `src/shared/components/MathText.tsx`, `content-banks/matematika/v3/*`, `tests/python/test_math*`, `tests/unit/components/MathText*`, `tests/fixtures/math-print-golden.fixture.ts`.
- Backup: `tmp/pdfs/math-v3/backup-20260918/` (eski v3).

## Kalit raqamlar (joriy)
- 368 mavzu × 30 = 11,040 savol; externalId (`mtp-*`) va javob kalitlari o'zgarmagan (hash: answer `3c8d0e4d…`).
- sqrt_empty 2403→0; double-circ 739→0; unbalanced 139→0; strict KaTeX 550→~0; `?` placeholder ~460 savol (ko'rinadigan, yashirilmagan).
