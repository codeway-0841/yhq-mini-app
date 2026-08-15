# 📋 KIWI (YHQ Mini App) — Qilingan Ishlar Jurnali (Changelog)

Loyiha bo'yicha amalga oshirilgan barcha yangiliklar, tuzatishlar va yangi funksiyalar ro'yxati.

---

## 🚀 So'nggi Yangilanishlar (2026-08-15)

### 1. 🎟️ Promokodlar Tizimi (Promo Code System)
* **Xususiyat:** Avtomaktablar, aksiyalar va hamkorlar uchun foydalanuvchilarga bepul Premium obuna va bonuslar taqdim etuvchi xavfsiz Promokodlar tizimi.
* **Xavfsizlik & Cheklovlar:** 1 kishi 1 marta ishlatish cheklovi (`promo_code_redemptions`), amal qilish muddati (`expires_at`), umumiy son limiti (`max_uses`), 1 daqiqada 5 ta urinishdan ortiq kiritishni bloklovchi anti-spam (Rate Limiter).
* **Mavjud muddatga qo'shilish:** Agar foydalanuvchida allaqachon faol Premium bo'lsa, yangi kunlar mavjud muddat ustiga qo'shiladi.
* **Interfeys:** Profil va Premium sahifalarida "🎟 Promokod faollashtirish" oynasi (`PromoCodeModal.tsx`), Confetti salyuti va darhol hisobni Premium qilish.
* **Fayllar:** `server/schema.ts`, `server/modules/promo/promo.router.ts`, `server/modules/promo/promo.repository.ts`, `src/shared/components/PromoCodeModal.tsx`, `src/features/profile/Profil.tsx`, `src/features/premium/PremiumPage.tsx`, `tests/unit/modules/promo.test.ts`.

---

### 2. 📊 Imtihondan Keyingi Chuqur Tahlil & Xatolar Ustida Ishlash (Exam Review)
* **Xususiyat:** Imtihon yakunlangach, natijalar oynasiga **"Xatolarni tahlil qilish"** (Exam Review) tugmasi qo'shildi.
* **Tahlil Modali:** Barcha savollar yoki faqat xatolar filtri, foydalanuvchining xato javobi (✗ Qizil), to'g'ri javob (✓ Yashil), mavzu nomi, qoida izohi ("Nega shunday?") va to'g'ridan-to'g'ri darslikka o'tish tugmasi.
* **Diagnostika:** Barcha imtihon turlarida (YHQ 40 talik, Milliy sertifikat, Attestatsiya, Mock) mavzular kesimidagi tahlil progress barlari bilan to'liq ochildi.
* **Fayllar:** `src/features/test/components/ExamReviewModal.tsx`, `src/features/test/ResultsModal.tsx`, `src/features/test/TestPage.tsx`, `tests/unit/features/exam-review.test.ts`.

---

### 2. 🛡️ Rasmiy Imtihonlar uchun "Anti-Cheat" (Shpargalka Himoyasi)
* **Qamrov:** Faqat rasmiy imtihon rejimlarida (`exam` — 40 talik YHQ, `exam:milliy-sertifikat` — 45 talik, `exam:attestatsiya` — 50 talik).
* **Faollikni aniqlash:** Brauzer tabidan chiqish (`visibilitychange`), ilovani yashirish (`blur`) yoki fonda qoldirish holatlarini sezadi.
* **3 Bosqichli Ogohlantirish & Jazo:**
  * **1-ogohlantirish (1/3):** ⚠️ Sariq ogohlantirish oynasi va tushuntirish.
  * **2-ogohlantirish (2/3):** 🚨 Qizil oxirgi ogohlantirish oynasi.
  * **3-ogohlantirish (3/3):** 🛑 Imtihon darhol to'xtatiladi, qolgan savollar javobsiz deb belgilanadi va natijalar oynasida diskvalifikatsiya qayd etiladi.
* **Xotira (Persistence):** Qoidabuzarliklar soni sessiya snapshotida saqlanadi — sahifani yangilash (reload) jazoni bekor qilmaydi.
* **Fayllar:** `src/features/test/components/AntiCheatModal.tsx`, `src/features/test/TestPage.tsx`, `src/features/test/ResultsModal.tsx`, `src/shared/lib/test-session.ts`, `tests/unit/features/anti-cheat.test.ts`.

---

### 2. 🔔 Android APK & Web uchun Mahalliy Bildirishnomalar (Local Notifications)
* **Kanal va Ruxsatlar:** Android 13+ tizim ruxsatlari (`POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`) va yuqori ustuvorlikdagi kanal (`daily_streak`) ulandi.
* **Kunlik Eslatma (Daily Streak Reminder):** Har kuni foydalanuvchi belgilagan vaqtda (`20:00`, `08:00`, `12:00`...) test yechish va seriyani saqlash eslatmasi chiqadi.
* **Sozlamalar Menyusi:** `SettingsModal.tsx` da eslatmani yoqish/o'chirish va qulay vaqt tanlagich (PickerSheet) joriy qilindi.
* **Fayllar:** `src/platform/native.ts`, `src/shared/components/SettingsModal.tsx`, `src/shared/store/useAppStore.ts`, `android/app/src/main/AndroidManifest.xml`, `tests/unit/platform/notifications.test.ts`.

---

### 3. 🧠 SM-2 Spaced Repetition (Aqlli Test Xotirasi) Bulut Sinxronizatsiyasi
* **Maqsad:** Har bir savol qiyinligini hisoblab, foydalanuvchiga unutish arafasida bo'lgan savollarni qayta takrorlatish algoritmi (SM-2).
* **Bulutli Saqlash:** `card_progress` jadvali, Drizzle migratsiyasi `0035_silly_nova.sql` va backend endpointlari (`GET /api/progress/:userId/cards` va `POST /api/progress/:userId/cards/review`) qo'shildi.
* **Offlayn Sinxronizatsiya:** `outbox.ts` orqali internet yo'q paytda ham ishlaydi va internet kelishi bilan serverga uzatiladi.

---

### 4. 🐛 Xatolar Testi (Xatolar Bo'limi) Qayta Yechish Tuzatmasi
* **Muammo:** Avval 2-3 marta xato qilingan savollar qayta to'g'ri yechilganda PostgreSQL bazasida `chk_progress_sum` constraint xatosi berib, "Offlayn javob saqlandi" deb qotib qolar edi.
* **Yechim:** Server progress tranzaksiyasida matematika to'g'rilandi (`total_correct = total_correct + correctDelta`), server duplicate javoblarda ham to'g'ri javob kalitini qaytaradigan qilindi va frontend darhol Yashil (✓) variantni ko'rsatadigan bo'ldi.
* **Fayllar:** `server/modules/progress/progress.repository.ts`, `server/modules/progress/progress.router.ts`, `src/features/test/TestPage.tsx`.

---

### 5. 📱 Yangi Android APK Build
* **APK Manzili:** `android/app/build/outputs/apk/debug/kiwi-debug.apk`
* **Texnologiya:** Capacitor 8 + Local Notifications + Java 21 JDK orqali muvaffaqiyatli yig'ildi (Build Successful).

---

## 📊 Test va Sifat Ko'rsatkichlari

* **Unit Testlar:** 25 ta fayl, 175 ta test — 100% Yashil (Passed).
* **TypeScript:** Frontend va Backend da 0 ta xatolik.
* **Qatlam Chegaralari:** `AGENTS.md` qoidalari bo'yicha toza arxitektura saqlangan.
