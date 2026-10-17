# Current decisions

- 2026-10-17: Keep agent startup instructions small; domain details live in architecture.md,
  backend.md and design.md. These retain the previous AGENTS.md details; dated incidents require
  current-code verification. Revisit when architecture changes.
- 2026-10-17: One agent for small changes; specialist delegation only with a bounded independent
  scope. Source: user-approved token-efficiency plan and .agents/skills/kivvi-workflow/SKILL.md.
- 2026-10-17: Preserve mathematical grid backgrounds in modals. Source: user's explicit preference;
  implementation: src/shared/components/StatInfoSheet.tsx. Revisit only on design direction change.
- 2026-10-17: scripts/agent-check.mjs captures logs and preserves failures. Existing CI remains
  authoritative for its configured gates; no recurring AI monitoring is enabled by this setup.

Store new confirmed decisions with evidence and revisit conditions, not daily activity logs.
