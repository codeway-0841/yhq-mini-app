# 🗺 YHQ Mini App — Qolgan ishlar (Roadmap)

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
