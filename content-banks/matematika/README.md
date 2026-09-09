# Matematika Test Banki — Ma'lumotlar va Tarix

Ushbu hujjat Matematika fani bo'yicha savollar bazasi, variantlar strukturasi, dublikatlar va Neon DB tarixi haqida hisobotdir.

## 1. Asosiy Ko'rsatkichlar

- **Fanning ID'si:** `matematika` (UI va routing)
- **Bank ID'si:** `math_db` (Neon DB)
- **Asosiy manba fayli:** `content-banks/matematika/math-print.json`
- **Jami mavzular (variantlar):** 368 ta
- **Har bir variantdagi savollar:** Aynan 30 tadan
- **Jami savol o'rni:** 11,040 ta (368 × 30)
- **Rasmlar (sxema va chizmalar):** 301 ta (`public/math-print/`)
- **Noyob (takrorlanmas) savollar:** 7,298 ta

## 2. Kategoriyalar

| Kategoriya | Variantlar | Savollar |
|---|---|---|
| Algebra | 121 | 3,630 |
| Geometriya | 40 | 1,200 |
| Algebra va Trigonometriya | 40 | 1,200 |
| Algebra va Geometriya | 164 | 4,920 |
| Kombinatorika | 3 | 90 |

«Algebra va Geometriya» blok-variantlari algebra/geometriya savollaridan tuzilgani uchun takrorlar mavjud (3,742 ta). Marafon/Tezkor/Adaptiv rejimlarda `deduplicateQuestions()` (legacy) va server-side semantik dedup (test-sessions v2) orqali foydalanuvchiga faqat **7,298 ta noyob savol** beriladi.

## 3. Manba va Ekstraksiya

- Manba: «Matematika Test Print» .NET ilovasi (`D:\Matematika Test Print`):
  - savol PDF'lari ilovaning managed resource'laridan ajratiladi (`scripts/extract-dotnet-pdf-resources.ps1`);
  - javob kalitlari FAQAT `NatijaDB.db` (SQLite) dan o'qiladi (368 variant × 30 javob, kontinuitet qattiq tekshiriladi);
  - `scripts/extract-math-print.py` savol matni/variantlarni ajratadi, LaTeX'ga normallashtiradi (KaTeX-uyg'un), diagrammalarni WEBP qilib renderlaydi.
- Ekstraksiya qat'iy fail-closed: yakuniy hisoblar (368 topics / 11,040 items / 301 rasm) yoki javob kalitlari buzilsa — JSON yozilmaydi.

## 4. Sifat Nazorati

- `npm run content:audit:math` — 110,400 ta matnning to'liq auditi (struktura, kalitlar, rasmlar, KaTeX render, sintaksis). 2026-09-08: **100% o'tdi** (0 kritik, 0 KaTeX xatosi).
- `npx tsx scripts/content-bank.ts validate content-banks/matematika/math-print.json` — format validatsiyasi.
- KaTeX rendering: `src/shared/components/MathText.tsx` (fizika bilan umumiy).

## 5. Neon DB Tarixi (2026-09-08)

1. Test DB va prod Neon'ga `scripts/import-math-bank.ts` orqali yuklandi (idempotent: `ON CONFLICT (bank_id, external_id) DO NOTHING`; canonical externalId `mtp-*` SAQLANADI — admin bulk-import endpoint bunday kafolat bermaydi).
2. Prod holat: 11,040 savol (id 16,359–27,398), 368 mavzu (slug `math_db-mtp-*`), 301 ta rasmli savol.
3. Takroriy ishga tushirish 0 ta yangi qator kiritadi (tekshirilgan).

## 6. Foydali Skriptlar

- `python scripts/extract-math-print.py [--reuse-images]` — manbadan qayta ekstraktsiya (Windows, `pymupdf`+`PIL` kerak; manba papkasi `D:\Matematika Test Print`).
- `npm run content:audit:math` — to'liq KaTeX/sifat auditi.
- `npx tsx scripts/import-math-bank.ts` — Neon DB'ga import (prod: `.env DATABASE_URL`; test: `DATABASE_URL="$TEST_DATABASE_URL"`).
- `npx tsx scripts/content-bank.ts export content-banks/matematika/math-print.json --out content-banks/matematika/out` — admin import payload'lar (eslatma: bulk-import endpoint externalId'ni numeric qiladi — asosiy yo'l `import-math-bank.ts`).
