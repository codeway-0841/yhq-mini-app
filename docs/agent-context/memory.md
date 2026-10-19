# Current decisions

- 2026-10-17: Keep agent startup instructions small; domain details live in architecture.md,
  backend.md and design.md. These retain the previous AGENTS.md details; dated incidents require
  current-code verification. Revisit when architecture changes.
- 2026-10-17: One agent for small changes; specialist delegation only with a bounded independent
  scope. Source: user-approved token-efficiency plan and .agents/skills/kivvi-workflow/SKILL.md.
- 2026-10-19: Modallardagi matematik to'r (kataklar) foni foydalanuvchi ko'rsatmasi bilan barcha modal/sheet'lardan
  olib tashlandi, toza silliq fon (`bg-psurface`) qilindi. Manba: foydalanuvchi talabi ("ha hammasidan uchir toza fon qil");
  implementatsiya: `src/shared/components/ModalShell.tsx`, `ui/sheet.tsx`, `ui/dialog.tsx`. Revisit: faqat dizayn yo'nalishi o'zgarsa.
- 2026-10-17: scripts/agent-check.mjs captures logs and preserves failures. Existing CI remains
  authoritative for its configured gates; no recurring AI monitoring is enabled by this setup.
- 2026-10-17: Russian textbook lives at `src/content/darslik-rustili/` (15 blocks, one `.md` per
  block, lazy `?raw` imports, `outline.json` for path nodes) and renders at `/darslik/rus-tili`
  through the shared learning-path UI (`LearningPath`/`LessonPreview` from `features/lessons`).
  Progress reuses `useLessonsStore` with module id `100 + blockId` and lesson index = section
  index, so it never collides with the YHQ lessons (1–8) or the interactive book (999). Block text
  is Russian (source conversation for teacher attestation); block titles and summaries are UZ+RU.
  Revisit if the textbook becomes DB-backed.
- 2026-10-19: Russian textbook topics now require a server-checked mastery test. `darslik_checks` caches
  one 2-MCQ + 1-input check per topic (first topic pre-seeded, others AI-generated on first request);
  `darslik_mastery` unlocks a topic only after every earlier topic passed. Client: `useDarslikMastery`
  fetches `/darslik/progress`, `TopicCheck` renders/submits, `useLessonsStore.readByUser` is local
  read state only. If AI is missing/fails (seen: Meta 402 billing_not_configured), the router logs the
  reason and `fallback-check.ts` builds a deterministic 2-MCQ + 1-input check from the topic source, so
  progress is not blocked by AI billing. `shared/darslik-mastery.ts` is the SSOT for topic order, grading,
  and check schema; `scripts/export-darslik-source.ts` regenerates `server/modules/darslik/source.json`
  (tail-cut summary/mini-test). Revisit if offline mastery or richer fallback questions are required.
- 2026-10-19 (1-blok piloti): `DARSLIK_CHECK_VERSION = 2` — 5–7 mashq, 4+ tur
  (`mcq`, `input`, `word_bank`, `match`, `listening`), kamida 1 listening. 1-blokning 12 mavzusi
  `server/modules/darslik/curated/block-01.ts`da qo'lda yozilgan (6 mashq, 5 tur) va AI'dan oldin
  ishlatiladi; AI faqat boshqa bloklar uchun draft, oxirgi chora legacy fallback. `LessonRunner`
  qadam-baqadam feedback, progress/combo/mascot, TTS va natija ekranini beradi; `TopicCheck` shu
  engine ustidagi wrapper, 2-MCQ + 1-input legacy oqimi saqlanadi. Javoblar public payloadda yo'q;
  `/answer` darhol feedback, `/submit` yakuniy server gating. v1 mastery `[2, 1]` versiyalari bilan
  o'qiladi, shuning uchun deploy eski progressni bloklamaydi. XP `progress.xp` + `daily_limits`,
  streak/kunlik vazifalar `dailyRepository.touchActivity` orqali — yangi gamification tizimi yo'q.
  2–15-bloklar va 537 mavzuning qolganlari o'zgarishsiz. Revisit next block migration.
- 2026-10-19 (darslik kesh integrity): `darslik_checks` endi `content_hash`, `source`
  (`curated|ai|fallback|legacy`) va `generated_at` saqlaydi (0075). Curated SSOT har
  `POST /darslik/:topicId/check`da o'qiladi; hash farq qilsa `ensureCurated` qatorni
  majburiy upsert qiladi, shuning uchun deploydan keyin eski AI/eski curated dars qolmaydi.
  Admin regeneratsiya: `POST /api/admin/darslik/regenerate` `{topicIds | blockId}` yoki
  `npm run darslik:regenerate -- --block=1 --yes` (dry-run mavjud) — yagona service
  (`server/modules/darslik/regenerate.ts`) keshni o'chiradi, curated mavzularni darhol
  qayta yozadi; API yo'li `audit_logs`ga yozadi.
  AI/fallback generation `onConflictDoNothing` bo'lib qoladi (parallel generatorlarda
  birinchi yozgan yutadi). `/check` javobi `revision` (SHA-256) qaytaradi; client uni
  `/answer` va `/submit`da yuboradi, mos kelmasa 409 `PRACTICE_CHANGED` va LessonRunner
  darsni avtomatik qayta yuklaydi (eski revision yubormagan clientlar ishlashda davom etadi).
  Revisit: revision'ni majburiy qilish kerak bo'lsa (barcha clientlar yangilangach).
- 2026-10-19 (darslik gamification qarorlari): dars mashqlari `progress.totalCorrect`,
  liga yoki achievement statistikasiga YOZILMAYDI — ular o'rganish faolligi, imtihon savoli
  emas (integration test qulflagan). XP va kunlik faollik faqat birinchi v2 mastery passda;
  takroriy submit yoki boshqa kuni eski mavzuni qayta topshirish streak/XP yozmaydi.
  Pass chegarasi pilotda 100% (xato bo'lsa butun dars retry); 80%+requeue hozircha
  qabul qilinmagan. `/answer` — learning feedback endpointi, javobni ataylab darhol
  qaytaradi; auth + topic lock + 60/min limit bilan cheklangan, imtihon boundary emas.
  Revisit: darslik XP liga/reytingga ta'sir qilsa yoki requeue mahsulot talabi bo'lsa.

Store new confirmed decisions with evidence and revisit conditions, not daily activity logs.
