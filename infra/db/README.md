# Baza regionini ko'chirish — us-east-2 → eu-central-1

## Nima uchun

Hisoblash Frankfurtda, baza Ogayoda:

| Qism | Region |
|---|---|
| Vercel funksiya (`vercel.json`) | `fra1` — Frankfurt |
| Render WS server (`render.yaml`) | `frankfurt` |
| **Neon baza** | **`us-east-2` — Ogayo** |

Ya'ni har bir SQL so'rovi Atlantikani kesib o'tadi, taxminan **90-110 ms**.
Test javobini belgilaganda foydalanuvchi sezadigan kutish shundan: bitta javob
`recordAnswer` uchun bitta, to'g'ri javobda esa `applyDamage` uchun yana bitta
okean oshib qaytishni talab qiladi.

Bazani `aws-eu-central-1` ga ko'chirish har bir so'rovdan ~100 ms oladi va
kodga umuman tegmaydi.

## Hozir qilish kerak

Bazada **19 MB, 49 jadval, 11 ta real foydalanuvchi**. Ommaviy chiqishdan keyin
bu son o'sadi va ko'chirish qiyinlashadi. Hozir amalda xavfsiz.

## Muhim cheklov

**Neon loyihasining regionini o'zgartirib bo'lmaydi** — u yaratishda qat'iy
belgilanadi. Yagona yo'l: yangi regionda YANGI loyiha ochib, ma'lumotni ko'chirish.

---

## Tayyorgarlik

Manba `PostgreSQL 18.6`, extension'lar: `plpgsql`, `pgcrypto`.

- Yangi Neon loyihasi **PostgreSQL 18** bilan yaratilsin — katta versiya mos
  kelmasa `pg_restore` yiqiladi.
- `pg_dump` / `pg_restore` mijozi ham **18-versiya** bo'lishi kerak.
  Bu mashinada `pg_dump` **o'rnatilmagan** — avval PostgreSQL 18 client tools
  o'rnating (yoki Neon'ning import sahifasidan foydalaning).
- Ikkala ulanish satri ham **UNPOOLED** bo'lsin. Pooler (PgBouncer) ortida
  `pg_dump`/`pg_restore` ishlamaydi.

```bash
pg_dump --version
```

---

## Qadamlar

### 1. Yangi loyiha

Neon konsolida: yangi loyiha → region **AWS Europe (Frankfurt) `aws-eu-central-1`**
→ Postgres **18**. Unpooled ulanish satrini oling.

### 2. Dump

```bash
pg_dump -Fc -v -d "$OLD_DATABASE_URL" -f yhq-backup.dump
```

`-Fc` — custom format (siqilgan, tanlab tiklash mumkin).
Bu fayl **butun bazangiz** — telefon raqamlari va sessiyalar ham. Tugagach o'chiring.

### 3. Restore

```bash
pg_restore -v -O -d "$NEW_DATABASE_URL" yhq-backup.dump
```

`-O` (`--no-owner`) **shart**: Neon'ning `neon_superuser` roli `ALTER OWNER`
bajara olmaydi, bu flagsiz xatolar chiqadi.

### 4. Tekshirish

```bash
OLD_DATABASE_URL="postgresql://...us-east-2..." NEW_DATABASE_URL="postgresql://...eu-central-1..." npx tsx infra/db/verify-migration.ts
```

Skript **faqat o'qiydi**. Solishtiradi: Postgres versiyasi, jadval ro'yxati,
har bir jadvaldagi qator soni, extension'lar va `drizzle.__drizzle_migrations`
yozuvlari soni.

Migratsiya jurnali muhim: yangi bazada tag'lar bo'lmasa, `vercel-build` ichidagi
`db:migrate` migratsiyalarni **qaytadan** ishga tushiradi.

Farq topilsa skript `exit 1` qaytaradi va cutover qilmaslikni aytadi.

### 5. Cutover

Uchta joyda `DATABASE_URL` almashtiriladi:

| Qayerda | Qanday |
|---|---|
| Vercel — `production` va `preview` | `vercel env rm` + `vercel env add`, so'ng redeploy |
| Render — `yhq-websocket-server` | Dashboard → Environment (`render.yaml` da `sync: false`) |
| Lokal `.env` | Qo'lda |

Vercel:

```bash
npx vercel env rm DATABASE_URL production --yes
```

```bash
npx vercel env add DATABASE_URL production
```

Ikkalasi ham yangi qiymatni olgach **redeploy** shart — funksiyalar env'ni build
paytida emas, ishga tushishda o'qiydi, lekin yangi deploy'siz eski instansiyalar
eski ulanish bilan qolishi mumkin.

### 6. Cutover'dan keyin

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<domen>/api/ready
```

`/api/ready` DB ping + savol pool tekshiruvini bajaradi — 200 bo'lsa ulanish tirik.

So'ng ilovada: bitta test yeching, javob **sezilarli tez** kelishi kerak.

---

## Xavflar

**Dump va cutover orasidagi yozuvlar yo'qoladi.** 19 MB uchun oyna bir necha
daqiqa. Kamaytirish uchun kam trafikli vaqtni tanlang. Javob yuborishlar uchun
client'da outbox bor (`src/shared/lib/outbox.ts`) — ulanish uzilsa javob navbatga
tushadi va keyin yetkaziladi, ya'ni test natijalari yo'qolmaydi. Lekin
ro'yxatdan o'tish, OTP va to'lov kabi oqimlar himoyalanmagan.

**Eski loyihani darhol o'chirmang.** Kamida bir hafta turishi kerak — muammo
chiqsa `DATABASE_URL` ni orqaga qaytarish yagona rollback yo'li.

**Kredensialni almashtiring.** Eski parol lokal `.claude/settings.local.json`
ichida ochiq matnda yotibdi (fayl `.gitignore` da, git tarixida yo'q — tekshirildi).
Yangi loyiha yangi parol beradi; eski loyiha o'chirilgach eskisi ham o'ladi.

**Integration testlar.** `TEST_DATABASE_URL` alohida baza va u ham `us-east-2` da.
Uni ko'chirish shart emas, lekin `server/check-test-db.ts` `TEST_DATABASE_URL`
`DATABASE_URL` ga TENG BO'LMASLIGINI talab qiladi — yangi qiymat qo'yganda buni
buzmang.

---

## Bu Vercel'ga bog'liqmi

Yo'q. `DATABASE_URL` — oddiy Postgres ulanish satri. Neon o'rniga boshqa
provayder qo'ysangiz ham, ko'chish tartibi va bu yerdagi tekshiruv skripti
o'zgarishsiz ishlaydi.
