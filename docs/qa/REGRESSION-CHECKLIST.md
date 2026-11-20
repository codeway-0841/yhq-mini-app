# Regressiya checklist (release oldidan)

Har band: 🟢 o'tdi / 🔴 yiqildi / 🟡 tekshirilmadi (sababi bilan).
Faqat test DB va test akkauntlar. Production ma'lumotlari taqiqlanadi.

## P0: pul va xavfsizlik
- [ ] Coin berish takroriy so'rovda ikki marta berilmaydi (idempotency)
- [ ] Bir vaqtdagi ikki claim bitta natija beradi
- [ ] To'lov holatlari: muvaffaqiyat / bekor / xato
- [ ] Entitlement (premium) faqat server tasdig'idan keyin ochiladi
- [ ] Scoring server tomonida hisoblanadi
- [ ] Ommaviy savol javobida to'g'ri javob/izoh chiqmaydi
- [ ] Boshqa foydalanuvchi ma'lumotiga kirib bo'lmaydi (403)

## P0: auth
- [ ] Telegram initData bilan kirish
- [ ] Sessiya tiklash (Bearer/initData)
- [ ] Akkaunt almashtirilganda eski ma'lumot tozalanadi
- [ ] Noto'g'ri/eskirgan token: tushunarli xato

## P1: asosiy yo'l
- [ ] Onboarding
- [ ] Dashboard va pastki navigatsiya (4 tab)
- [ ] Test yechish va natija
- [ ] Profil / sozlamalar
- [ ] Orqaga/yopish (back/close) modallarda

## P2: ko'rinish
- [ ] Mobil (Pixel 7): matn o'qiladi, overflow yo'q
- [ ] Desktop
- [ ] Light / Dark
- [ ] UZ / RU
- [ ] Safe-area, header to'liq no-shaffof

## Avtomatik
- [ ] Typecheck client + server
- [ ] Unit
- [ ] API
- [ ] E2E
- [ ] Integration (test DB)
- [ ] Build

## Qaror
**GO / NO-GO:** 
