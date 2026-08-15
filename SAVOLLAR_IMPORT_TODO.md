# 📥 Savollarni Ommaviy Yuklash (Bulk Questions Import) — Keyingi Ishlar Ro'yxati (TODO)

> **Holat:** Hozirgi kunda CSV/TSV, JSON va Smart Text (AI nusxa) parserlari `src/features/admin/lib/universalQuestionParser.ts` orqali ishlaydi. Quyidagi murakkabroq va xususiy holatlar keyingi bosqichda to'liq mukammallashtirish uchun belgilandi.

---

## 📋 Qilinadigan Ishlar Ro'yxati:

### 1. 📊 To'g'ridan-to'g'ri Binary Excel (`.xlsx`, `.xls`) Formatini O'qish
- [ ] `xlsx` (SheetJS) kutubxonasini ulash orqali Excel faylni CSV'ga o'girmasdan to'g'ridan-to'g'ri bir nechta sahifalar (Sheets) kesimida o'qish.
- [ ] Har bir sahifa (Sheet) alohida mavzu (Topic) sifatida avtomatik tanilishi.

### 2. 🖼️ Rasmli Savollarni Ommaviy Yuklash (Image Zip Upload)
- [ ] Savollar bilan birga ZIP faylda rasmlarni yuklash (masalan `q001.jpg`, `q002.png`) va avtomatik savol ID'siga bog'lash.
- [ ] Cloudflare R2 / S3 / Supabase Storage'ga rasmlarni ommaviy yuklash va URL'larini bazaga joylash.

### 3. 📑 Word (`.docx`) va PDF Fayllardan Testlarni Ajratib Olish
- [ ] `.docx` va `.pdf` formatidagi test kitoblarini yuklaganda savol va variantlarni avtomatik ajratib olish (OCR / Regex / AI Extraction).

### 4. 🤖 AI Yordamida Savollar Generatsiyasi (Admin AI Generator)
- [ ] Admin panelda istalgan mavzu bo'yicha (masalan: *"Fizikadan Nyuton qonunlariga oid 20 ta qiyin test tuzib ber"*) bitta buyruq bilan 20-50 ta tayyor test generatsiya qilib, to'g'ridan-to'g'ri bazaga kiritish.

### 5. 🔍 Kengaytirilgan Xatoliklar Logi va Excelga Qayta Eksport
- [ ] Agar 1000 ta savoldan 15 tasida xatolik bo'lsa, faqat o'sha 15 ta xato savolni Excel qilib qayta yuklab berish (`xatoliklar.csv`), admin tuzatib qayta yuklashi uchun.

---

## 📌 Hozirgi Mavjud Imkoniyatlar:
* ✅ CSV va TSV (nuqta-vergul, vergul, tab) ko'p qatorli matnlar va qo'shtirnoqlarni to'liq o'qish.
* ✅ Matn nusxalash (Smart Text) orqali ChatGPT yoki Word testlarini bir zumda tahlil qilish.
* ✅ JSON massivlarini va obyektlarini to'liq o'qish.
* ✅ Oldindan ko'rish (Preview) oynasida savollarni tahrirlash va to'g'ri javobini bitta bosishda o'zgartirish.
* ✅ 8 ta fan (YHQ, Matematika, Fizika, Kimyo, Ingliz tili, Tarix, Biologiya, Rus tili) kesimida alohida banklarga yozish.
