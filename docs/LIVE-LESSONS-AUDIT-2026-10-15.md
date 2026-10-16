# Jonli dars — senior audit va release holati (2026-10-15)

## Natija

Jonli darslar uchun delete, huquq, davomat, jadval, chat va recording lifecycle kod darajasida tuzatildi. Release hali to'liq tasdiqlanmagan: yangi DB migratsiyalarini test muhitida qo'llash va haqiqiy Neon + LiveKit + R2 orqali ikki foydalanuvchili E2E sinov o'tkazish kerak. Bu ishda production DB/deploy o'zgartirilmadi.

## Topilgan kamchiliklar va tuzatishlar

| Daraja | Kamchilik | Tuzatish |
| --- | --- | --- |
| P1 | Darsni o'chirish yo'li yo'q edi; aktiv darsni hard-delete qilish chat/davomat/yozuv tarixini yo'qotar edi. | Manager-only `DELETE /api/live/rooms/:id` soft archive; aktiv efir avval yakunlanadi, arxivlangan xona va yozuv ro'yxatdan yashiriladi. `0071` migratsiya. |
| P1 | Revoke qilingan student qayta join qilib eski `can_speak` huquqini tiklashi mumkin edi. | Qo'l statusi va participant ruxsati DB'da birga bekor qilinadi; join ruxsatni qayta hisoblaydi. LiveKit permission xatosida disconnect fallback. |
| P1 | Client `leave` yubormasa davomat ochiq qolardi; kech webhook yangi join'ni yopishi mumkin edi. | Imzolangan LiveKit `participant_left`/`connection_aborted` webhook; event timestamp bilan guarded close. |
| P1 | `scheduledAt` naive timestamp bo'lib, timezone siljishi va muddatidan oldin start/join xavfi bor edi. | UTC `timestamptz` (`0072` migratsiya), DB-level start guard, student uchun pre-live join blok, ustoz uchun lobby, UI'da vaqt gate. |
| P2 | Bir ustoz bir soniyada ikki xona yaratsa vaqtinchalik `room_name` UNIQUE to'qnashishi, ikki statement o'rtasida yarim yozilgan xona qolishi mumkin edi. | Sequence ID va `live_<id>` bitta atomik INSERT'da. |
| P2 | Chat cursor o'z xabarini yuborganda oldinga sakrab, oraliq xabarlarni o'tkazib yuborishi mumkin edi. | Cursor faqat ketma-ket server o'qishidan yuradi; ID bo'yicha dedup va tartiblash. |
| P2 | 5 soniyalik polling barcha ulanuvchilarda ortiqcha HTTP/DB trafik tug'dirardi. | LiveKit server-origin data invalidation (`state`/`chat`); API qayta o'qiladi, 30s fallback; ulanmagan yoki signal yo'q holatda 5s fallback. |
| P1 | Egress stop/delete xatosi yutilib, dars `ended` deb ko'rinishi va recording `stopping`da qolishi mumkin edi. | `ending` holati va retry tugmasi saqlanadi; Cloud xatolari 503, 404 idempotent. Webhook DB xatosida 500 qaytib retryga imkon beradi. `updated_at`/CAS va `ListEgress` bilan 60s reconcile (`0073` migratsiya). |
| P1 | Recording yoqilib, LiveKit/R2/public playback env'lari yarim sozlangan bo'lsa xato faqat dars paytida bilinardi. | Production fail-fast: recording uchun LiveKit, R2 account/key/bucket va public URL birgalikda majburiy. MP4 to'g'ridan-to'g'ri R2'ga yoziladi; Neon'da faqat metadata. |

## Muhim cheklovlar

- Reconcile manager sahifasi ochiq bo'lganda ishlaydi. Webhook umuman yetib kelmasa va manager ham qaytmasa, fon cron recovery hali yo'q; operatsion monitoring kerak.
- LiveKit signal xatosida tizim HTTP polling fallback'ga tushadi; real-time latency shu paytda 5–30 soniya bo'lishi mumkin.
- Haqiqiy audio/video, ikki rol, egress → R2 fayl, webhook va migration E2E lokal testda isbotlanmagan. Shell muhitida alohida test infra aktiv emas; `.env`dagi test DB izolyatsiyasi tasdiqlanmagani uchun unga mutatsion test/migratsiya ishga tushirilmadi.
- `0071`, `0072`, `0073` migratsiyalar tartib bilan qo'llanishi shart. `0072` eski naive qiymatlarni UTC deb talqin qiladi; boshqa timezone'da saqlangan eski yozuvlar bo'lsa release'dan oldin tekshirish kerak.

## Verifikatsiya va release gate

- Unit testlar: live lifecycle/repository/control/client regressiyalar; migration journal testi.
- Frontend/backend TypeScript, ESLint, frontend/backend build.
- Test DB: migration pre-flight guard bilan `0071` → `0072` → `0073`; eski schedule qiymatlari UTC saqlanganini tekshirish.
- Staging E2E: ustoz yaratish → schedule gate → start → ikki student join → chat signal/fallback → raise/approve/revoke/rejoin → majburiy disconnect attendance → recording start/stop/webhook/ready playback → archive → ro'yxat va yozuv ko'rinmasligi.
- Fault injection: LiveKit StopEgress/DeleteRoom 5xx, webhook DB 5xx, webhook yo'qolishi, R2 key yo'qligi, bir vaqtdagi ikki join/reconcile.

2026-10-16 lokal infra probe: R2 bucket'da vaqtinchalik `live-recordings/_probe/connection-check.txt` yozildi, HEAD bilan tekshirildi va o'chirildi; yakuniy HEAD obyekt yo'qligini tasdiqladi. LiveKit control API autentifikatsiyadan o'tdi va mavjud bo'lmagan probe xona uchun kutilgan 404 qaytardi. Probe Neon'ga yozmadi.

Asosiy kod: `server/modules/live/`, `src/features/live/`, `shared/live.ts`, `migrations/0071_tired_silverclaw.sql`, `migrations/0072_organic_sentinels.sql`, `migrations/0073_foamy_silver_samurai.sql`.
