# 📋 KIWI (YHQ Mini App) — Qilingan Ishlar Jurnali (Changelog)

Loyiha bo'yicha amalga oshirilgan barcha yangiliklar, tuzatishlar va yangi funksiyalar ro'yxati.

---

## 🚀 So'nggi Yangilanishlar (2026-08-15)

### 1. 🔔 Aqlli Telegram Bot Eslatmalari (Smart Retention Push Notifications)
* **Xususiyat:** O'quvchilarni ilovaga qaytarish, o'rganish intizomi (Streak) uzilib qolishini oldini olish, haftalik liga natijalarini e'lon qilish va Premium tugashini eslatuvchi to'liq avtomatik push-eslatmalar tizimi.
* **Avtomatik Eslatmalar Turlari:**
  * 🔥 **Streak Himoyasi & Kunlik Mashq (`/cron/daily-reminder`):** Bugun mashq qilmagan o'quvchiga uning shaxsiy streak kunini (`🔥 Ali, 5 kunlik seriyangiz xavf ostida!`) ko'rsatib, 2 daqiqalik testga chaqirish.
  * 👋 **Nofaollikni Qaytarish (`/cron/inactivity-reminder`):** 2-3 kun kirmagan o'quvchilarga do'stona motivatsion xabar va WebApp tugmasi.
  * 🏆 **Haftalik Turnir & Liga Natijalari (`/cron/league-rollover`):** Dushanba kuni yuqori ligaga ko'tarilganlarni tabriklash (`🥇 Oltin ligasiga ko'tarildingiz!`) va yangi turnirga chorlash.
  * 👑 **Premium Tugashi Ogohlantirishi (`/cron/premium-expiring`):** Premium muddati ertaga tugaydiganlarga eslatma va yangilash tugmasi.
* **Sozlamalar & Nazorat:**
  * ⚙️ **Foydalanuvchi Sozlamalari:** `SettingsModal.tsx` da "🔔 Telegram xabarnomalari" tugmasi orqali o'quvchi eslatmalarni yoqib/o'chirib qo'yishi mumkin (`notificationsEnabled`).
  * 🛠️ **Admin Jonli Sinov:** Admin panel `AdminBroadcastTab.tsx` dan bir marta bosishda Streak, Inactivity, Liga va Premium namunalarini o'zining Telegramiga yuborib ko'rish imkoniyati.
  * 🛡️ **Telegram Limit Himoyasi:** 20 talik xavfsiz batching, 50ms kechikish va bloklangan botlarni toza filtrlash.
* **Fayllar:** `server/modules/notifications/retention.service.ts`, `server/modules/cron/cron.router.ts`, `server/modules/admin/admin.router.ts`, `src/shared/components/SettingsModal.tsx`, `src/features/admin/components/AdminBroadcastTab.tsx`.

---

### 2. 💳 Click.uz To'lov Tizimi Integratsiyasi (O'zbek so'mida Premium Obuna)
* **Xususiyat:** Foydalanuvchilar o'zbek so'mida (Uzcard / Humo plastik kartalari, Click ilovasi yoki veb orqali) 1 oylik, 1 yillik yoki umrbod Premium obunani bir zumda sotib olishlari mumkin.
* **Narxlar (SSOT `shared/premium-plans.ts`):**
  * 📅 **Oylik (30 kun):** `29 000 so'm` (yoki ⭐ 99 Stars)
  * 🌟 **Yillik (365 kun — Eng mashhur):** `79 000 so'm` (yoki ⭐ 250 Stars)
  * 👑 **Umrbod (Cheksiz):** `149 000 so'm` (yoki ⭐ 500 Stars)
* **Backend & Xavfsizlik:**
  * 🧾 `payment_orders` jadvali (unikal buyurtma raqamlari, holat va xavfsiz hisob-kitob).
  * 🔐 Click MD5 imzo (Signature) tekshiruvi (Prepare action 0 va Complete action 1).
  * ⚡ CTE tranzaksiya orqali to'lov tasdiqlanishi bilan avtomatik entitlement aktivatsiya qilish.
  * 📡 `POST /api/payments/click` webhook va `POST /api/payments/create-order`, `GET /api/payments/check-order/:orderId` endpointlari.
* **Frontend & UI:**
  * 📱 `PaymentMethodModal.tsx` — Click yoki Telegram Stars to'lov usulini tanlash.
  * 🔄 Jonli to'lov tekshiruvi (Polling), to'lov tasdiqlangach avtomatik **Confetti**, **Yutuq tovushi** va profilni bir zumda Premium qilish.
* **Fayllar:** `server/modules/payments/click.service.ts`, `server/modules/payments/payment.router.ts`, `server/schema.ts`, `shared/premium-plans.ts`, `src/features/premium/components/PaymentMethodModal.tsx`, `src/features/premium/PremiumPage.tsx`.

---

### 2. 🔍 Test Yechishda Interaktiv Rasm Kattalashtirish (Interactive Image Pinch & Zoom)
* **Xususiyat:** Test yechish vaqtida yoki imtihon tahlilida savol rasmlarini to'liq ekranda 4x gacha kattalashtirib, batafsil ko'rish imkoniyati.
* **Qulayliklar:**
  * 🔍 **Ko'rgazmali indikator:** Test savolidagi rasm ustida "🔍 Kattalashtirish" tugmasi.
  * 📱 **Pinch-to-zoom & Double-tap:** Ikki barmoq bilan cho'zish (Pinch) yoki 2 marta tez bosish (Double-tap) orqali kattalashtirish/kichraytirish.
  * 🖐️ **Surish (Pan Dragging):** Kattalashtirilgan vaqtda rasmni barmoq yoki sichqoncha bilan erkin surib har bir detalni ko'rish.
  * 🎛️ **Boshqaruv Paneli:** Zoom darajasi ko'rsatkichi (`150%`, `200%`, `400%`), `+` / `-` tugmalari va `100%` (Asliga qaytarish) tugmasi.
  * 🖥️ **Sichqoncha g'ildiragi (Wheel Zoom):** Kompyuterda g'ildirakcha yordamida tezkor zoom.
* **Fayllar:** `src/shared/components/ImageZoomModal.tsx`, `src/features/test/TestPage.tsx`, `src/features/test/components/ExamReviewModal.tsx`.

---

### 2. 🖼️ Admin Savollar uchun Rasm Faylini To'g'ridan-To'g'ri Yuklash (Question Image File Upload)
* **Xususiyat:** Yangi savol yaratish va tahrirlashda tashqi URL qidirib o'tirmasdan, to'g'ridan-to'g'ri telefon galereyasidan yoki kompyuterdan rasm yuklash (JPG, PNG, WEBP).
* **Qulayliklar:**
  * 📁 Faylni tanlash (Drag & drop yoki bosish).
  * ⚡ Avtomatik siqish (Canvas auto-compression — 1280px).
  * 🖼️ Jonli miniatyura (Thumbnail), rasmni almashtirish (🔄) va o'chirish (🗑️) tugmalari.
  * 🔄 Fayl yuklash va URL manzil kiritish rejimlari o'rtasida bitta tugma bilan almashish.
* **Fayllar:** `src/features/admin/components/AdminQuestionsTab.tsx`, `server/modules/admin/admin.router.ts`.

---

### 2. 📢 Telegram Bot Ommaviy Xabarnoma (Broadcast / E'lonlar)
* **Xususiyat:** Admin panel orqali barcha Telegram bot obunachilariga chiroyli formatlangan e'lonlar, aksiyalar, eslatmalar va yangiliklar yuborish tizimi.
* **🎯 Aniq Auditoriyani Tanlash (Targeting):**
  * 👥 Barcha foydalanuvchilar
  * 🆓 Faqat Bepul (Free) foydalanuvchilar (Aksiya va Premium taklif qilish uchun)
  * 👑 Faqat Premium foydalanuvchilar
  * 😴 Nofaol o'quvchilar (7+ kundan beri kirmaganlar — Retention)
  * ⚡ Bugun faol bo'lgan o'quvchilar
* **📱 Jonli Telegram Mockup (Preview):** Xabar yuborilishidan oldin Telegram'da qanday ko'rinishi (Rasm, Matn, Emojilar, Inline WebApp CTA tugmasi) real vaqtda ko'rinib turadi.
* **🧪 Xavfsizlik & Sinov:** Avval faqat o'ziga test xabar yuborib ko'rish imkoniyati, tasdiqlash modali va Telegram Bot API limitlariga mos (25 msg/s) uzluksiz batch yuborish.
* **Fayllar:** `src/features/admin/components/AdminBroadcastTab.tsx`, `server/modules/admin/broadcast.service.ts`, `server/modules/admin/admin.router.ts`, `src/features/admin/AdminPage.tsx`, `src/shared/api/index.ts`, `tests/unit/modules/broadcast.test.ts`.

---

### 2. 📥 Savollarni Ommaviy Yuklash (Bulk Questions Import via CSV / Text / JSON)
* **Xususiyat:** Har qanday fanga (YHQ, Rus tili, Matematika, Fizika, Kimyo, Ingliz tili, Tarix, Biologiya) yuzlab savollarni bir vaqtda tez va xatosiz yuklash imkoniyati.
* **3 Ta Yuklash Usuli:**
  * **📄 CSV / Excel Fayl:** Excel yoki Google Sheets'dan eksport qilingan `.csv` faylni yuklash.
  * **📝 Matn (AI / Word):** ChatGPT yoki Word'dan olingan testlarni (`1. Savol... A)... B)... To'g'ri: A`) to'g'ridan-to'g'ri nusxalab tashlash (Smart Parser).
  * **💻 JSON Kod:** JSON formatidagi savollar massivini joylash.
* **Qulayliklar:** Bir bosishda namunaviy `.csv` va `.json` shablonlarini yuklab olish (Download Template), savollarni yuklashdan oldin xatoliklarni tekshirish (Pre-validation Preview) va xavfsiz batch insert.
* **Fayllar:** `src/features/admin/components/BulkImportModal.tsx`, `src/features/admin/components/AdminQuestionsTab.tsx`, `server/modules/admin/admin.router.ts`, `src/shared/api/index.ts`, `tests/unit/modules/bulk-import.test.ts`.

---

### 2. 👑 Kengaytirilgan Admin Panel (Admin Control Center)
* **4 ta Asosiy Bo'lim (Tabs):**
  * **🎟 Promokodlar:** Yangi promokod yaratish (nomi, 7k/15k/30k/90k/365k muddat, limit, tugash sanasi), barcha promokodlar ro'yxati, to'xtatish/faollashtirish (Pause/Resume), o'chirish va Telegram link nusxalash.
  * **❓ Savollar (Fanlar bo'yicha mustaqil):** Barcha fanlar (🚗 YHQ, 🇷🇺 Rus tili, ⚡ Fizika, π Matematika, 🧪 Kimyo, 🇬🇧 Ingliz tili, 📖 Tarix, 🧬 Biologiya) bo'yicha alohida tanlagich (Chips), har bir fanning o'z savollari soni va mavzulari statistikasi, tanlangan fanga yangi savol qo'shish, qidirish, tahrirlash va o'chirish.
  * **👥 Foydalanuvchilar:** Foydalanuvchilarni ID, ism, username yoki telefon orqali qidirish, natijalarini ko'rish va to'g'ridan-to'g'ri Premium (1 hafta, 1 oy, 3 oy, 1 yil, Umrbod) berish yoki bekor qilish.
  * **📊 Jonli Statistika:** Jami foydalanuvchilar, faol Premium obunachilar, bugungi faol o'quvchilar (DAU), jami yechilgan savollar va promokodlar soni.
* **Fayllar:** `src/features/admin/AdminPage.tsx`, `src/features/admin/components/AdminPromoTab.tsx`, `src/features/admin/components/AdminUsersTab.tsx`, `src/features/admin/components/AdminStatsTab.tsx`, `src/features/admin/components/AdminQuestionsTab.tsx`, `server/modules/admin/admin.router.ts`, `server/modules/promo/promo.router.ts`, `shared/subjects.ts`, `server/providers/default.provider.ts`, `tests/unit/modules/admin-panel.test.ts`.

---

### 2. 🎟️ Promokodlar Tizimi (Promo Code System)
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
