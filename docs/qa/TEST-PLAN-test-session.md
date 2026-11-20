# Test reja: Test yechish oqimi (test sessions)

- **Modul:** `server/modules/test-sessions/*`, `src/features/test/*`
- **Xavf darajasi:** Yuqori (scoring, javob xavfsizligi, premium kirish)
- **Manba:** error kodlari `test-sessions.service.ts` / `.router.ts` dan olingan
- **Muhit:** faqat test DB. Production ma'lumotlari taqiqlanadi.

## 1. Acceptance criteria
- [ ] Foydalanuvchi sessiya boshlaydi, savollar oladi, javob beradi, natija ko'radi
- [ ] Ommaviy savol payload'ida to'g'ri javob va izoh yo'q
- [ ] Natija serverda hisoblanadi
- [ ] Bir javob takroriy yuborilsa natija buzilmaydi (idempotency)
- [ ] Faqat sessiya egasi unga kira oladi
- [ ] Premium talab qiladigan test premiumsiz ochilmaydi

## 2. Senariylar

### A. Sessiya yaratish
| # | Senariy | Kutilgan | Qatlam |
| --- | --- | --- | --- |
| A1 | Faol fan, yetarli savol | Sessiya yaratiladi | API |
| A2 | Autentifikatsiyasiz | 401 `authentication_required` | API |
| A3 | Mavjud bo'lmagan fan | 404 `subject_not_found` | API |
| A4 | Nofaol fan | 400 `subject_inactive` | API |
| A5 | Qo'llab-quvvatlanmagan selector/preset | 400 `selector_not_supported` / `exam_preset_not_supported` | API |
| A6 | Premium test, premiumsiz foydalanuvchi | 403 `premium_required` | API |
| A7 | Savollar yetarli emas | 409 `not_enough_questions` | API |
| A8 | Mavzu / bilet mavjud emas | 404 `topic_not_found` / `ticket_not_found` | API |
| A9 | Xatolar yoki saqlangan savollar bo'sh | 404 `mistakes_empty` / `saved_questions_empty` | API |
| A10 | Noto'g'ri launch token | 403 `invalid_launch_token` | API |
| A11 | `language` faqat `uz`/`ru` | Boshqa qiymat rad etiladi | API |

### B. Javob berish
| # | Senariy | Kutilgan | Qatlam |
| --- | --- | --- | --- |
| B1 | To'g'ri javob | Qabul qilinadi, progress yangilanadi | API |
| B2 | Noto'g'ri variant | 400 `invalid_option` | API |
| B3 | Berilmagan savolga javob | 400 `question_not_issued` | API |
| B4 | Noto'g'ri delivery proof | 403 `invalid_delivery_proof` | API |
| B5 | Bir xil javob takror | Natija o'zgarmaydi | API |
| B6 | Bir savolga boshqa javob bilan takror | 409 `answer_idempotency_conflict` | API |
| B7 | Ikki parallel so'rov | Bitta natija, ma'lumot buzilmaydi | Integration |
| B8 | Savollar banki o'zgargan | 409 `test_session_bank_changed` | API |

### C. Sessiya holati
| # | Senariy | Kutilgan | Qatlam |
| --- | --- | --- | --- |
| C1 | Sessiya topilmadi / noto'g'ri uuid | 404 `test_session_not_found` / validatsiya xatosi | API |
| C2 | Boshqa foydalanuvchining sessiyasi | Kirish rad etiladi (404/403) | API, **P0** |
| C3 | Tugagan sessiyaga javob | 409 `test_session_<status>` | API |
| C4 | Muddati o'tgan sessiya | 410 `test_session_expired` | API |
| C5 | Savollar tugamasdan yakunlash | 409 `test_attempt_incomplete` | API |
| C6 | Sahifani yangilash / qaytish | Sessiya davom etadi | E2E |

### D. Xavfsizlik
| # | Senariy | Kutilgan | Qatlam |
| --- | --- | --- | --- |
| D1 | Savollar javobida `correctOptionId`/izoh yo'q | Faqat ruxsat etilgan maydonlar | API, **P0** |
| D2 | Izoh (`explain`) javobdan keyin beriladi | Oldin berilmaydi | API |
| D3 | Network javobini qo'lda o'zgartirish | Server natijasi hal qiladi | E2E |

### E. UI (Pixel 7 va Desktop, Light/Dark, UZ/RU)
| # | Senariy | Kutilgan |
| --- | --- | --- |
| E1 | Savol, variant tanlash, keyingisi | Ishlaydi, matn o'qiladi |
| E2 | Taymer tugashi | Natijaga o'tadi |
| E3 | Natija oynasi | Ball serverdagi bilan bir xil |
| E4 | Orqaga / yopish | Dialog to'g'ri yopiladi |
| E5 | Anti-cheat modal | Ko'rinadi va yopiladi |
| E6 | Overflow, safe-area | Yo'q |

## 3. Mavjud qoplama (o'qib chiqildi, ishga tushirilmagan)
Unit: `test-sessions.router`, `test-sessions.service`, `test-session-proof`, `test-answer-flow`, `test-anti-cheat`, `test-session*`.
E2E: `biletlar.spec.ts` (faqat 2 ta yengil test: sahifa va orqaga tugmasi).
**Bo'shliq:** to'liq E2E yo'li (boshlash → javob → natija) va integration (B7, C2) tekshirilmagan. Bularni qo'shish kerak.

## 4. Keyingi qadamlar
1. Unit testlar A–D ni qanchalik qoplashini ko'rib chiqish.
2. Yetishmayotgan API/integration testlarni (C2, D1, B7) yozish.
3. Bitta to'liq E2E yo'l: sessiya → javob → natija.

## 5. Qaror
**GO / NO-GO:** (to'ldiriladi)
