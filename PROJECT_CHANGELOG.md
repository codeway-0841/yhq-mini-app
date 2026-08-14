# YHQ Mini App — Bajarilgan Ishlar va Arxitektura Hujjati (Changelog & Architecture Guide)

Ushbu hujjat loyihada amalga oshirilgan barcha o'zgarishlar, qo'shilgan funksiyalar, ma'lumotlar bazasi tuzilmasi va tuzatilgan muammolarni to'liq tushuntiradi. Kelgusida boshqa AI yoki dasturchi loyihani davom ettirganda ushbu qo'llanmadan to'liq foydalanishi mumkin.

---

## 1. 📚 1000 ta Rus Tili Savollari (To'liq Baza)

### 📌 Muammo:
Avval faqat 300 ta YHQ (o'zbekcha) savollari mavjud edi. Rus tili fani uchun PDF fayllardan rasmiy 10 ta variant $\times$ 100 ta = 1000 ta savolni to'liq matni, variantlari va javoblari bilan ajratib olish talab etildi.

### 🛠️ Qilingan ishlar:
1. **PDF Ekstraktsiya:** PDF fayllardan barcha 10 ta variant (1-10 variantlar, jami 1000 ta savol) matni birorta harf yoki belgisi qisqarmasdan ajratib olindi (`content/russian_questions.json`).
2. **PostgreSQL Bazaga Seed Qilish:**
   - `server/seed-russian.ts` orqali Neon PostgreSQL `questions` va `topics` jadvallariga `bank_id = 'traffic_rules_db'` bilan xavfsiz va idempotent tarzda kiritildi.
   - Savollar ID raqamlari: `4001` dan `5000` gacha (har bir variantda 100 tadan).
3. **Mavzular (Topics):** Har bir variant uchun alohida ruscha va o'zbekcha mavzu (`1-variant` ... `10-variant`) yaratildi.

---

## 2. 🔀 Fanlar Izolyatsiyasi (1300 ta va 1000 ta savol aralashib ketishini to'g'irlash)

### 📌 Muammo:
Foydalanuvchi Rus tili faniga kirganda 1300 ta savol ko'rinib (300 ta YHQ + 1000 ta Rus tili aralashib), keyin 1000 taga tushib qolayotgan edi.

### 🛠️ Qilingan ishlar:
1. **Repository Filteri (`server/modules/questions/questions.repository.ts`):**
   - `findAll()`, `findById()`, `findByTopic()`, `findTopics()` funksiyalariga `bank_id` bo'yicha qat'iy filter qo'yildi.
2. **Provider Strategiyasi (`server/providers/`):**
   - `RussianQuestionBankProvider` Strategy pattern asosida faqat rus tili savollarini (`id >= 4001 AND id <= 5000`) yuklaydigan qilindi.
   - `YhqQuestionBankProvider` faqat YHQ savollarini (`id >= 1 AND id <= 300`) yuklaydi.
3. **Frontend Re-fetch (`src/App.tsx` & `src/shared/store/useSubjectStore.ts`):**
   - Foydalanuvchi fanni almashtirishi bilanoq `useQuestionsStore.getState().load(lang, subjectId)` darhol faol fanning savollarini tortadi.

---

## 3. 🔘 Savollar Almashganda Tugmada Yashil Chegara Qolib Ketishi Bug'i

### 📌 Muammo:
Test yechishda foydalanuvchi biror variantni (masalan F3) tanlab keyingi savolga o'tganda, keyingi savolda ham o'sha F3 tugmasida yashil chegara (`border-duo-green`) ko'rinib qolayotgan edi.

### 🛠️ Qilingan ishlar:
1. **Kompozit Kalit (`key={`${q.id}_${opt.id}`}`):**
   - `src/features/test/TestPage.tsx`, `SpeedPage.tsx`, `AdaptivePage.tsx`, `RoundScreen.tsx` fayllarida variantlar kaliti `key={opt.id}` o'rniga `key={`${q.id}_${opt.id}`}` qilindi. React har bir savol uchun yangi toza DOM tugmasini render qiladi.
2. **Neytral Hover (`src/features/test/OptionButton.tsx`):**
   - Default tugma stili `hover:border-duo-green/50` dan neytral `hover:border-pline/60 hover:bg-elevated/60` ga o'zgartirildi.
3. **Fokusni Tozalash (`blur`):**
   - Savol o'zgarganda `document.activeElement.blur()` chaqirilib, brauzer/sensorli ekran fokusi majburiy tozalanadi.

---

## 4. ⚡ Dastlabki Yuklashda Faol Fanning Savollarini Darhol O'qish (Boot Loading)

### 📌 Muammo:
Ilovaga kirganda bir zumda 300 ta savol ko'rinib, keyin 1000 taga o'zgarayotgan edi.

### 🛠️ Qilingan ishlar:
1. **`src/shared/store/useQuestionsStore.ts`:**
   - Dastlabki `subjectId` `useSubjectStore.getState().subjectId || 'yhq'` orqali localStorage'dagi oxirgi tanlangan fandan olinadigan qilindi.
2. **`src/App.tsx`:**
   - `loadQuestions` funksiyasi `useQuestionsStore.getState().load(lang, useSubjectStore.getState().subjectId)` tarzida joriy fanni berib chaqiriladi.
3. **`src/features/dashboard/Dashboard.tsx`:**
   - Testlar kartasidagi statik `'300'` fallback olib tashlandi, faol fanning haqiqiy yuklangan savollar soni ko'rsatiladi.

---

## 5. 📊 Dinamik Foiz va Unikal Progress Hisoblash (0% – 100%)

### 📌 Muammo:
- Progress kartasi testlar bazasining foizini emas, to'g'ri javoblar aniqligini (`accuracy %`) ko'rsatayotgan edi.
- Agar foydalanuvchi 1 ta savolni 10 marta yechsa, progress 10 ta savol yechildi deb sun'iy ko'payib ketishi mumkin edi.

### 🛠️ Qilingan ishlar:
1. **Dinamik Formula (`src/features/dashboard/components/ProgressCard.tsx`):**
   $$\text{Progress \%} = \begin{cases} 0 & \text{agar } \text{yechilgan} = 0 \\ \min\left(100, \max\left(1, \text{round}\left(\frac{\text{yechilgan}}{\text{jami savollar}} \times 100\right)\right)\right) & \text{agar } \text{yechilgan} > 0 \end{cases}$$
   - Fanda 1000 ta savol bo'lsa: 10 ta yechsa $\rightarrow$ 1%, 500 ta yechsa $\rightarrow$ 50%, 1000 ta yechsa $\rightarrow$ 100%.
   - Fanda 1250 ta savol bo'lsa: 125 ta yechsa $\rightarrow$ 10%, 1250 ta yechsa $\rightarrow$ 100%.
2. **Unikal Savollar Deduplikatsiyasi (`solvedQuestions`):**
   - Foydalanuvchi 1-savolni 10 marta yoki 100 marta yechsa ham, u faqat **1 ta unikal savol** deb hisoblanadi.
   - Har bir fanning o'z savollari alohida hisoblanadi (`yhq:1`, `rustili:1`).

---

## 6. ☁️ Qurilmalararo Bulutli Sinxronizatsiya (Cross-Device Cloud Sync)

### 📌 Muammo:
Foydalanuvchi boshqa qurilmadan (masalan, Android APK yoki boshqa telefondan) o'z akkauntiga kirganda yoki sahifani yangilaganda yechilgan savollar progressi yo'qolib ketmasligi kerak.

### 🛠️ Qilingan ishlar:
1. **DB Schema Migratsiyasi (`server/schema.ts` & `migrations/0034_orange_slipstream.sql`):**
   - PostgreSQL `progress` jadvaliga `solved_questions jsonb DEFAULT '[]'::jsonb NOT NULL` ustuni qo'shildi va Neon DB'ga migrate qilindi.
2. **Atomik Javob Yozish (`server/modules/progress/progress.repository.ts`):**
   - Foydalanuvchi test yechganda CTE orqali `solved_questions` massiviga unikal `subjectId:questionId` kaliti atomik qo'shiladi:
     ```sql
     solved_questions = CASE
       WHEN ${qKey}::text IS NULL THEN solved_questions
       WHEN solved_questions @> jsonb_build_array(${qKey}::text) THEN solved_questions
       ELSE solved_questions || jsonb_build_array(${qKey}::text)
     END
     ```
3. **API Contract & Users Service (`shared/contracts/profile.ts` & `server/modules/users/users.service.ts`):**
   - `ApiProgressSchema`ga `solvedQuestions: z.array(z.string()).optional()` qo'shildi.
   - `toApiProgress` profilda foydalanuvchining barcha unikal yechilgan savollarini qaytaradi.
4. **Frontend Store Sync (`src/shared/store/useAppStore.ts`):**
   - `hydrateFromProfile` va `syncFromServer` orqali serverdan kelgan va lokal `solvedQuestions` to'liq birlashtiriladi (merge).
   - `partialize` va `migrate` yangilanib, localStorage'da doimiy saqlanadi.

---

## 7. 🎠 Rejimlar Carouseli (Asl Holatga Qaytarilgan)

- `src/features/dashboard/Dashboard.tsx` dagi `RejimlarCarousel` komponenti o'zining asl dizayni (`17px bold` sarlavha, `Yana / Ещё` tugmasi, silliq auto-scroll, snap-scroll, hover/touch pauza) bilan to'liq qayta tiklandi.

---

## 8. 🚀 Foydali Buyruqlar va Testlash (Verification)

```bash
# 1. Barcha unit testlarni ishga tushirish (22 ta fayl, 166 ta test)
npm test

# 2. Frontend va Backend TypeScript Typecheck
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.server.json --noEmit

# 3. Production Build
npm run build
npm run build:api
npm run build:server

# 4. DB Migratsiyalarni yurgizish
npm run db:migrate

# 5. Vercel Production Deploy
npx vercel --prod --yes
```

---

## 9. 🌐 Jonli Havola (Live Production)
- **Vercel Domen:** [https://yhq-mini-app.vercel.app](https://yhq-mini-app.vercel.app)
- **GitHub Repo:** `github.com:codeway-0841/yhq-mini-app.git` (branch: `master`)
