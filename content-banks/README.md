# Content banks

Bu papka YHQdan keyingi fanlar uchun master kontent formatidir. Maqsad: savollarni avval JSONda toza tayyorlash, keyin validator orqali tekshirib, admin bulk importga mos payload chiqarish.

## Format

Har fan bitta master JSONdan boshlanadi:

```txt
content-banks/
  fizika/
    bank.json
    images/
  matematika/
    bank.json
```

Boshlash uchun namunani nusxalang:

```bash
mkdir -p content-banks/fizika
cp content-banks/_template/content-bank.sample.json content-banks/fizika/bank.json
```

## Tekshirish

```bash
npx tsx scripts/content-bank.ts validate content-banks/fizika/bank.json
```

Validator quyidagilarni ushlaydi:

- `subjectId`, `bankId`, `topics`, `items` borligi
- topic `externalId`/`slug` takrorlanmasligi
- savol `externalId` takrorlanmasligi
- har savol topicga bog‘langanligi
- `optionsUz` va `optionsRu` kalitlari bir xil bo‘lishi
- `correctAnswer` variantlar ichida borligi
- tushuntirish bo‘lsa UZ/RU ikkalasi borligi

## Export

```bash
npx tsx scripts/content-bank.ts export content-banks/fizika/bank.json --out content-banks/out
```

Chiqadigan fayllar:

- `*.topics.json` — DBga kiritilishi kerak bo‘lgan mavzular ro‘yxati
- `*.topic-ids.template.json` — DBdagi topic IDlarni to‘ldirish uchun map
- `*.bulk-import.json` — `/api/admin/questions/bulk-import` payloadi
- `*.explanations.json` — tushuntirishlar sidecar fayli

Hozirgi admin bulk import `topicId` kutadi. Shuning uchun mavzular DBga kirgach `topic-ids.template.json` ichidagi `null` qiymatlarni haqiqiy IDlarga almashtiring va exportni qayta chiqaring:

```bash
npx tsx scripts/content-bank.ts export content-banks/fizika/bank.json --out content-banks/out --topic-ids content-banks/out/fizika.physics_db.topic-ids.json
```

## Kontent yozish qoidasi

Variant kalitlari har doim `A1`, `A2`, `A3`, `A4` bo‘lsin. `correctAnswer` shu kalitlardan biri bo‘ladi. Savol va variantlar UZ/RUda ma’no jihatdan bir xil bo‘lishi kerak.

`externalId` barqaror bo‘lsin: savol matni keyin o‘zgarsa ham ID o‘zgarmasin. Masalan:

```txt
physics_mechanics_001
math_algebra_linear_001
english_grammar_tenses_001
```

`difficulty`, `source`, `explanationUz`, `explanationRu` hozir ham foydali: ular keyingi AI tutor, imtihon rejimi, sifat auditi va tushuntirish seedlariga tayyor turadi.
