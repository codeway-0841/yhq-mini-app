# Fizika Test Banki — Ma'lumotlar va Tarix

Ushbu hujjat Fizika fani bo'yicha savollar bazasi, biletlar strukturasi, dublikatlarni boshqarish va Neon DB tarixi haqida to'liq hisobotdir.

## 1. Asosiy Ko'rsatkichlar

- **Fanning ID'si:** `fizika` (UI va routing)
- **Bank ID'si:** `physics_db` (Neon DB)
- **Asosiy manba fayli:** `content-banks/fizika/physics-print.json`
- **Jami mavzular (biletlar):** 296 ta
- **Har bir mavzudagi savollar:** Aynan 30 tadan
- **Jami savol o'rni:** 8,880 ta (296 × 30)
- **Rasmlar (sxema va chizmalar):** 1,301 ta (`public/images/physics-print/`)
- **Noyob (takrorlanmas) savollar:** 5,197 ta

## 2. Dublikatlar va Marafon Rejimi (Smart Deduplication)

Asl «Fizika Test Print» to'plamida:
- **1–148 biletlar:** Mavzuli testlar (Kinematika, Dinamika, Molekulyar, Elektr, Optika, Kvant va h.k.) — 4,440 ta savol.
- **149–296 biletlar:** «Umumiy fizika» (Blok testlar) — 4,440 ta savol.

Blok testlar mavzuli testlardagi savollardan tuzilgani uchun savollar takrorlangan:
- **Biletlar rejimida:** 296 ta asl bilet o'zgarishsiz, to'liq saqlanadi.
- **Marafon, Tezkor va Adaptiv testlarda:** `src/shared/lib/test-session.ts` dagi `deduplicateQuestions()` funksiyasi savol matni, rasmi va variantlari bo'yicha takrorlarni filtrlaydi. Natijada foydalanuvchiga faqat **5,197 ta sof, noyob savol** beriladi va bir xil savol 2 marta chiqmaydi.

## 3. 11,358 vs 8,880 Neon DB Tarixi (2026-09-06)

Ilgari platformada eski fizika bazasi bo'lgan:
- **Eski baza:** `phys_*` prefiksli **2,478 ta savol** va 101 ta eski mavzu (`fizika-*`).
- Yangi «Fizika Test Print» bazasi (8,880 ta `ftp-*` savoli va 296 ta mavzu) yuklanganda, eski baza o'chirilmay qolib ketgan.
- Natijada Neon DB'dagi `physics_db` da jami $2,478 + 8,880 = \mathbf{11,358}$ ta savol yig'ilib qolgan edi.

**2026-09-06 da amalga oshirilgan tozalash:**
1. Barcha 2,478 ta eski savol va 101 ta mavzu to'liq zaxira fayliga saqlandi:
   `content-banks/fizika/old-physics-backup-2478.json` (1.99 MB).
2. Neon DB'dagi `physics_db` dan eski 2,478 ta savol va 101 ta mavzu o'chirildi (`scripts/clean-neon-old-physics.ts`).
3. Hozirda Neon DB'da FAQAT yangi **8,880 ta savol** va **296 ta mavzu** mavjud.

## 4. Foydali Skriptlar

- `npm run content:audit:physics` — Barcha 88,800 matn va 1,301 ta rasmni 100% tekshirish.
- `npx tsx scripts/check-neon-db.ts` — Neon DB'dagi savollar va banklar sonini tekshirish.
- `npx tsx scripts/clean-physics-print.py` — Matn va KaTeX tozalash skripti.
