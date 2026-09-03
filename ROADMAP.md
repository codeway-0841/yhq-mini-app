# 🗺 KIVVI — Qolgan ishlar (Roadmap)

> 2026-08-26 holati. To'liq senior production audit yakunland: **4 CRITICAL + 13 HIGH + 12 MEDIUM/LOW** yopildi.
> CI: ✅ 672 test · build yashil · prod sog'lom.

---

## ⛔ 1. Siz qilishingiz kerak (kod emas — 10 daqiqa)

- [ ] **Prod DB migratsiya tekshiruvi** — Neon SQL editor:
  ```sql
  SELECT tag FROM drizzle.__drizzle_migrations ORDER BY created_at LIMIT 2;
  SELECT column_name FROM information_schema.columns
   WHERE table_name = 'users' AND column_name = 'phone';
  ```
  Ikkalasi ham natija qaytarsa — ✅. `0001_add_phone` jurnalda yo'q, lekin ustun bor bo'lsa → jurnal INSERT kerak (skript tayyor, so'rang).
- [ ] **Vercel → Project → Cron Jobs** — FAQAT 2 ta yozuv ko'rinishi kerak: `daily-suite` (14:00 UTC), `weekly-suite` (dushanba 00:15 UTC)
- [ ] **Ilovani sinash** — yopib-oching, Dashboard/bir test/izoh/streak ishlasin
- [x] **Baza regionini ko'chirish** — BAJARILDI 2026-08-27. Neon `us-east-2` dan
  `aws-eu-central-1` ga ko'chirildi (`ep-mute-rain-b1e8v8fq`), endi Vercel `fra1`
  va Render `frankfurt` bilan bir regionda. Har bir SQL so'rovidan ~100 ms tejaldi.
  49 jadval, 19 MB, qator sonlari bir-biriga mos — yo'qotish nol.
  `DATABASE_URL` uch joyda almashtirildi: Vercel `production` + `preview`, Render,
  lokal `.env`. `/api/ready` 200 qaytardi.
  Runbook + tekshiruv skripti: `infra/db/README.md`.
- [ ] **Fluid Compute holatini tekshirish** — Vercel dashboard → Settings → Functions.
  Yoqilgan bo'lsa Vercel instansiyani so'rovlar orasida qayta ishlatadi va sovuq
  start kamayadi; kod o'zgarmaydi. Men bu sozlamani API orqali o'qiy olmadim.
  Kontekst: 2026-08-27 da `@sentry/node` dinamik yuklashga o'tkazildi va sovuq
  `/api/health` 3.63s dan 1.35s ga tushdi (bittadan o'lchov). Qolgan ~0.9s —
  Node boot + `drizzle-orm`/`express` yuklanishi. Fluid uni ham kesadi.
  Yana ~0.8s Neon compute uyg'onishidan (`ready` sovuq 1.37s, issiq 0.69s) —
  free tarifda autosuspend 5 daqiqa, o'zgartirib bo'lmaydi.

- [ ] **Eski Neon loyihasini o'chirish** — `ep-late-resonance-ax7o314j` (`us-east-2`).
  Kamida BIR HAFTA turishi kerak (2026-09-03 dan keyin) — muammo chiqsa
  `DATABASE_URL` ni orqaga qaytarish yagona rollback yo'li. O'chirilgach eski
  parol ham o'ladi; u hozir `.claude/settings.local.json` da ochiq matnda.
- [ ] **Vercel Firewall qoidalarini PUBLISH qilish** — 2 ta qoida QORALAMADA turibdi,
  hali jonli EMAS. Ikkalasi ham `log` rejimida, hech kimni bloklamaydi:
  ```bash
  npx vercel firewall diff
  ```
  ```bash
  npx vercel firewall publish --yes
  ```
  Publish qilinmasa ma'lumot yig'ilmaydi. Tafsilot: `infra/vercel/README.md`.
  **Publish'dan keyin:** kamida 1 hafta dashboard'ni kuzating
  (`https://vercel.com/<team>/yhq-mini-app/firewall`). `observe-api-volume-per-ip`
  ishga tushishi HUJUM DEGANI EMAS — 3000/min normal operator shlyuziga teng.

---

## 📦 2. Paket D — funksional yakunlanish (ustuvorlik tartibida)

### D3. Telegram Stars refund oqimi
User Stars'ni refund qilsa, Telegram qaytarib beradi, lekin bizning `premiumUntil` QOLADI.
- `refund_star_payment` worker (admin yoki scheduler) + refund webhook registry
- `premiumUntil` qisqartirish (tarif C-1 qoidasi bilan mos: GREATEST'dan uzaytirmaydi)
- **Ta'sir:** Telegram qoidasi + pul yo'qotish xavfi

### D4. Referral anti-farm
Bitta qurilmada ko'p profil yaratib premium-kun koninukhimilanish mumkin.
- `user_devices` fingerprint register/link paytida tekshiruv (mavjud infra!)
- Mukofotni faqat "yangi user ≥3 kun faol" bo'lgach berish
- **Ta'sir:** iqtisodiy himoya (premium kunlik zaxira)

### D5. APK deep-link
`uz.kiwi.yhq://` va https-applink'lar APK'da ochilmaydi.
- `App.addListener('appUrlOpen', ...)` → router navigatsiya
- Duel invitelari, email linklar ishlasin — APK o'sish strategiyasi uchun
- **Qiyinlik:** o'rta (1-2 sessiya)

---

## 🔧 3. Qolgan MEDIUM/LOW (keyingi sprint)

| # | Ish | Fayl/soha | Baholangan vaqt |
|---|---|---|---|
| M-4 | `avatar/p_<phone>` enumerate himoyasi (telefon↔rasm PII) | `users.router.ts:170` | 30 min |
| M-5 | So'nggi CLICK webhook so'rovga `x-request-id` tracing | request-logger | 10 min |
| L-2 | Octagon savol tanlov `Math.random` → `crypto.randomInt` | `octagon.ts:309` | 15 min |
| L-3 | Sertifikat server-issue (foydalanuvchi o'zi soxtashtira oladi) | `certificate.router.ts` | 2 soat |
| CI | GitHub Actions `@v4` → `@v5` (Node 20 deprecation) | `.github/workflows/ci.yml` | 5 min |
| Software | `.env.example`'ga BOT_WEBHOOK_SECRET format | `.env.example` | 2 min |
| Repo | 727 rasm 112MB — eng katta 50 tasini recompress (~30-50KB) | `public/images/yhq/*` | 1 soat (skript) |
| UX | Google Fonts 6 → 2 asosiy (+ lazy qolgani) | `index.html:120` | 15 min |

---

## 🚫 Qayta qarorlar (kayd etilgan — qaytarmang)

1. ~~Ashubliklar auth-only~~ → **QAYTARILDI:** savollar PUBLIC+CDN (2026-08-26). Himoya: correctAnswer server'da + izoh post-answer + IP tripwire.
2. ~~Render plan starter~~ → **user qarori: free** (uyqu trade-off'ni qabul qildik; keyin trafik oshsa ko'tariladi).
3. ~~`plan:` cron'lar alohida~~ → **2 fanout-suite** (Vercel Hobby limiti). Pro'ga o'totsangiz `vercel.json`'da 4 schedule'ga qaytariladi.

---

## 🔐 Xavfsizlik posturalari (hozirgi holat — audit'dan keyin)

- initData HMAC + timing-safe + 1 soat replay oynasi + boot freshness gate
- Sessiya: sha256 DB'da, Bearer dual auth, session-expired event
- Parol: crypto.scrypt, OTP: HMAC-pepper + 60s cooldown + 10/kun/telefon cap + 5-attempt lockout
- Parol reset: idempotent tokenlar, sessiya revoke
- Click/Stars: imzo fail-closed, atomik claim, idempotent ledger
- Scoring: correctAnswer server-only, anti-farm CTE, DAILY_ANSWER_CREDIT, answer_tokens
- Coins: ledger-first idempotent, negative-balance guard, advisory lock (merch)
- WS: origin allowlist (prod), heartbeat, msg+conn rate-limit, per-user cap, ws error handlers
- Process: unhandledRejection/uncaughtException → Sentry + graceful shutdown
- Rate limit: DB-backed (multi-instance), fail-closed, per-endpoint bucket'lar
- Retention cron: 6 jadval tozalanadi (sessions/otp/tokenlar/history/audit/analytics)

**CI himoyasi:** 672 unit + integration (real PG) + e2e (playwright) + npm audit + migratsiya jurnali guard.

---

*Oxirgi katta sessiya: 2026-08-26 — audit + 15+ fix + 8 commit push.*
