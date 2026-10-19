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

Store new confirmed decisions with evidence and revisit conditions, not daily activity logs.
