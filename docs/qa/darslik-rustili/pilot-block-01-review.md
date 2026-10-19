# Rus tili darsligi — 1-blok pilot darslari (qo'lda review)

**Holat:** pilot, faqat 1-blok (12 mavzu). 2–15-bloklar va 537 mavzuning qolganlari
o'zgarishsiz: eski 2 MCQ + 1 input oqimi ishlaydi.

**Manba:** `src/content/darslik-rustili/block-01.md`.
**Kontent fayli:** `server/modules/darslik/curated/block-01.ts`.
**Schema:** `shared/darslik-mastery.ts` (`DarslikCheckSchema`, `format: 'lesson'`).

## Nega qo'lda review

Pilot savollari AI bilan generatsiya qilinmaydi. Router tartibi
`curated → AI draft → fallback` bo'lgani uchun 1-blok mavzulari Meta AI
billing xatosidan (402 `billing_not_configured`) qat'i nazar ishlaydi.
AI faqat boshqa bloklar uchun draft sifatida qoladi.

## Mashqlar inventari

Har mavzuda 6 ta mashq va 5 xil tur: `mcq`, `input`, `word_bank`, `match`,
`listening`. Har mavzuda kamida bitta tinglash mashqi bor.

| Mavzu | Sarlavha | Tinglash audio | Manba bog'lanishi |
|---|---|---|---|
| 1:0 | ЗВУКИ И БУКВЫ | ёлка | [й'олка], 5 звуков |
| 1:1 | ГЛАСНЫЕ И СОГЛАСНЫЕ ЗВУКИ | юг | [й'ук], Ю = 2 звука |
| 1:2 | ТВЁРДЫЕ И МЯГКИЕ СОГЛАСНЫЕ | мяч | [м'] мягкий |
| 1:3 | ЗВОНКИЕ И ГЛУХИЕ СОГЛАСНЫЕ | лодка | [лотка], оглушение |
| 1:4 | СОНОРНЫЕ СОГЛАСНЫЕ | май | [й'] сонорный |
| 1:5 | ШИПЯЩИЕ И СВИСТЯЩИЕ | шёпот | [ш] шипящий |
| 1:6 | Ь И Ъ | подъезд | разделительный Ъ |
| 1:7 | БУКВЫ Е, Ё, Ю, Я | поёт | Ё после гласной = 2 звука |
| 1:8 | СЛОГ | молоко | мо-ло-ко, 3 слога |
| 1:9 | УДАРЕНИЕ | звонить | зво-нИть, 2-й слог |
| 1:10 | ФОНЕТИЧЕСКИЙ РАЗБОР | ёлка | 4 буквы, 5 звуков, 2 слога |
| 1:11 | ОРФОЭПИЧЕСКИЕ НОРМЫ | каталог | ка-та-лОг, 3-й слог |

## Versiya mosligi (v1 → v2)

- `DARSLIK_CHECK_VERSION = 2`; eski v1 sxemasi `DarslikCheckSchema` ichida
  saqlanadi (`format` yo'q yoki `'legacy'`).
- `darslik_mastery` o'qishda ikkala versiya ham hisobga olinadi
  (`DARSLIK_CHECK_VERSIONS = [2, 1]`). v1 bilan o'tilgan mavzu qayta
  ochilmaydi va keyingi mavzu qulflanmaydi.
- Yangi dars oqimi (5–7 mashq) faqat v2; yangi urinishda v2 check yaratiladi.
  v2 yaratilmasa AI → fallback → mavjud v1 check tartibida ishlaydi.
- Deploy paytida v1 darsni ochgan foydalanuvchi submit qilganda v2 check yo'q
  bo'lsa, server v1 checkni topib baholaydi (`findCheck`) — yarim yo'lda
  bloklanmaydi.
- v2 pass `darslik_mastery`ga v2 qatori sifatida yoziladi; v1 qatori
  o'chirilmaydi. XP faqat birinchi v2 passda beriladi.

## Qo'lda tekshirish ro'yxati

- [x] Har mashq darslik matnidagi aniq qoidaga tayanadi; ikki xil talqin yo'q.
- [x] Har `mcq`/`listening` variantlari unikal (registr saqlanadi: `звОнит ≠ звонИт`).
- [x] Har `input` javobi qisqa va bir xil ma'noda; registr/probel tolerantligi bor.
- [x] Har `word_bank` javobi tokenlar ichidan olinadi; distraktorlar boshqa gap tuzmaydi.
- [x] Har `match` chap va o'ng ustunlari unikal; o'ng ustun public payloadda aralashtiriladi.
- [x] Har `listening` `audioText` darslik manbasida mavjud (test bilan ushlanadi).
- [x] Har mashqda izoh bor; xato javobdan keyin to'g'ri javob serverdan qaytadi.
- [x] Javoblar, `correctIndex`, `explanation`, `pairs` public payloadda yo'q.

## Avtomatik guard'lar

- `tests/unit/server/darslik-pilot-content.test.ts` — 12 mavzu, 5–7 mashq,
  4+ tur, listening, public payload, o'z kaliti bilan pass, manba audio.
- `tests/unit/features/darslik-lesson-engine.test.ts` — schema, grading,
  public payload, XP.
- `tests/unit/server/darslik.router.test.ts` — curated birinchi, AI'siz,
  darhol feedback, submit, v1 moslik, fallback.
- `tests/unit/features/LessonRunner.test.tsx` — 5 turdagi mashq, feedback,
  progress, combo, natija, retry.

## Mobil vizual tekshiruv (390×844)

Playwright (Chromium, 390×844, DPR 2) bilan dars oqimi boshidan oxirigacha
o'tildi. Gorizontal overflow yo'q (`document.scrollWidth === 390`).

| Fayl | Holat |
|---|---|
| `07-lesson-exercise-390.png` | Dars boshlanishi, mcq, progress 1/6 |
| `08-lesson-feedback-390.png` | Xato feedback + to'g'ri javob + izoh |
| `09-lesson-input-390.png` | Yozma mashq, klaviatura/fokus |
| `10-lesson-word-bank-390.png` | So'z banki, tanlangan tokenlar |
| `11-lesson-match-390.png` | Juftliklar, combo ×2 |
| `12-lesson-listening-390.png` | Tinglash mashqi, TTS tugmasi |
| `13-lesson-final-mcq-390.png` | Oxirgi mashq, combo ×4 |
| `14-lesson-final-feedback-390.png` | To'g'ri feedback, "Yakunlash" |
| `15-lesson-result-390.png` | Fail natija, aniqlik 83%, retry |
| `16-lesson-retry-390.png` | Retry boshidan, 1/6 |
| `19-lesson-result-pass-390.png` | Pass natija: 100%, +32 XP, streak 4, "Davom etish" |
| `17-lesson-error-390.png` | Yuklash xatosi + qayta urinish |
| `18-lesson-locked-390.png` | Qulflangan mavzu |
| `20-lesson-ru-feedback-390.png` | Rus tili interfeysi (RU i18n) |

Keyingi mavzu ochilishi `tests/unit/features/RussianDarslikPilot.test.tsx`
bilan tasdiqlangan: v2 dars pass bo'lgach `1:1` tuguni `aria-disabled`
bo'lmaydi va reader `2/12`ga o'tadi.

## Cheklovlar

- Tinglash Web Speech API (TTS) orqali; qurilmada rus ovozi bo'lmasa brauzer
  default ovozi ishlatiladi. Static audio asset qo'shilmadi (og'ir kutubxona yo'q).
- Pilotdan tashqari mavzular eski 3 topshiriqli fallback'da qoladi; ular uchun
  Duolingo oqimi keyingi bosqichda kengaytiriladi.
- XP faqat birinchi passda beriladi; takroriy pass 0 XP (farming himoyasi).
