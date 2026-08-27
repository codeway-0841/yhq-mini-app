# Vercel-ga xos infratuzilma

Bu katalogdagi hamma narsa **platformaga bog'liq** va **ilova kodidan ajratilgan**.

`server/` va `src/` ichida bu katalogga hech qanday import yoki bog'liqlik **yo'q**.
Boshqa hostingga ko'chishda butun `infra/vercel/` ni o'chirish yetarli — ilova
o'zgarishsiz ishlayveradi (batafsil: [Ko'chish](#boshqa-hostingga-kochish)).

---

## Firewall (WAF) — kuzatuv rejimi

Qoidalar: [`firewall.rules.json`](./firewall.rules.json). **Hech biri bloklamaydi.**

Nima uchun bloklash yo'q: foydalanuvchilar Telegram Mini App'da, ya'ni asosan
mobil tarmoqda. Operatorlar CGNAT ishlatadi — minglab abonent bitta public IPv4
ortida. Har qanday IP bo'yicha bloklash begona odamlarni ham uradi. Avval
ma'lumot yig'iladi.

### Qo'llash

Qoidalar **qoralama** sifatida saqlanadi. Jonli bo'lishi uchun `publish` kerak —
uni **siz** bajarasiz, agent emas.

```bash
npx vercel firewall rules add "observe-api-volume-per-ip" --condition '{"type":"path","op":"pre","value":"/api"}' --action rate_limit --rate-limit-window 60 --rate-limit-requests 3000 --rate-limit-keys ip --rate-limit-action log --yes
```

```bash
npx vercel firewall rules add "observe-exploit-probes" --condition '{"type":"path","op":"inc","value":["/wp-admin","/wp-login.php","/.env","/.git/config","/phpmyadmin","/vendor/phpunit/phpunit/phpunit.xml"]}' --action log --yes
```

O'zgarishlarni ko'rish va jonlashtirish:

```bash
npx vercel firewall diff
```

```bash
npx vercel firewall publish --yes
```

### Kuzatish

Dashboard: `https://vercel.com/<team>/yhq-mini-app/firewall`

Qoida ID'sini olish:

```bash
npx vercel firewall rules list --json
```

**Muhim o'qish qoidasi:** `observe-api-volume-per-ip` ishga tushishi
**hujum degani emas**. 3000/min chegarasi 200 ta bir vaqtdagi foydalanuvchiga
teng — bu normal operator shlyuzi. Qoida taqsimotning yuqori qismini
ko'rsatish uchun. Kamida bir hafta kuzating.

### Orqaga qaytarish

```bash
npx vercel firewall rules remove "observe-api-volume-per-ip" --yes
```

```bash
npx vercel firewall rules remove "observe-exploit-probes" --yes
```

So'ng `npx vercel firewall publish --yes`. Qoidalar log rejimida bo'lgani uchun
o'chirish hech qanday foydalanuvchi trafigiga ta'sir qilmaydi.

### Enforcement'ga o'tish (hozir EMAS)

Bir hafta ma'lumot yig'ilgandan keyin va faqat dashboard haqiqiy suiiste'molni
ko'rsatsa. Tartib: `log` → preview muhitida `deny` → production'da `deny`.
Har bosqichda dashboard tekshiriladi.

**Hech qachon `deny` ni `ip_address` yoki `ja4_digest` bo'yicha keng shart bilan
qo'ymang** — CGNAT va umumiy barmoq izlari tufayli begona foydalanuvchilar
qamaladi.

---

## Avtomatik DDoS himoyasi

Vercel L3/L4/L7 DDoS mitigatsiyasini **har bir loyihada, har bir tarifda**
avtomatik beradi. Konfiguratsiya talab qilmaydi va bu yerda sozlanmaydi.

Ilova ichidagi IP limiti ([`server/app.ts`](../../server/app.ts)) shuning uchun
ataylab juda bo'sh (6000/min) — u yagona devor emas, faqat qo'pol flood to'sig'i.

---

## Boshqa hostingga ko'chish

| Qism | Vercel'ga bog'liqmi | Ko'chishda nima bo'ladi |
|---|---|---|
| `infra/vercel/` | Ha, butunlay | **O'chiriladi.** Ilova kodi tegilmaydi |
| `vercel.json` | Ha | Yangi platformaning marshrut/header konfiguratsiyasiga ko'chiriladi |
| `api/` (serverless entry) | Ha | `server/standalone.ts` allaqachon mavjud — u oddiy Node server |
| Avtomatik DDoS | Ha | **Yo'qoladi.** Yangi platformada muqobili kerak (Cloudflare va h.k.) |
| CDN kesh (`Cache-Control`) | Yo'q | Standart HTTP sarlavhalari — har qanday CDN tushunadi |
| `server/middleware/rate-limiter.ts` | **Yo'q** | O'zgarmaydi |
| `identityKey` / `userId` kaliti | **Yo'q** | O'zgarmaydi |
| `server/middleware/db-rate-limiter.ts` | **Yo'q** | Postgres'da, platformadan mustaqil |
| Cron (`vercel.json` crons) | Ha | Yangi platformaning scheduler'iga ko'chiriladi |

Qisqasi: **rate limiting va auth qatlamlari platformadan mustaqil.** Ular
Express + Postgres ustida ishlaydi va Vercel API'lariga murojaat qilmaydi.
Ko'chishda haqiqiy ish — `vercel.json` (marshrut, header, cron) va avtomatik
DDoS o'rniga muqobil topish.
