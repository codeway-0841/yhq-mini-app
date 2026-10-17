# Setup validation — 2026-10-17

- Original instructions preserved across architecture/backend/design references: comparison
  after whitespace normalization passed. No domain rule text was dropped.
- Root instruction characters: 53,623 → 5,062 (90.6% reduction; Unicode code points).
  Reproduce with node scripts/agent-context-audit.mjs. Not a token/quota savings measurement.
- Existing dialog-motion unit file passed through agent-check; exit 0 and local log produced.
- Temporary deliberately failing Vitest fixture returned exit 1 through agent-check with diagnostics.
  The probe was removed immediately; no intentionally failing test remains in the repository.
- QA role TOML parsed successfully with Python tomllib; fields match official standalone agent schema:
  https://learn.chatgpt.com/docs/agent-configuration/subagents
- Official skill quick_validate.py could not run: available Python lacked PyYAML.
  scripts/agent-workflow-validate.mjs checks these intentionally simple two-field headers,
  required reference paths and runner input guards; it is not a general YAML validator.
- Independent read-only scenario exercise: mobile XP wrapping chose one agent and visual/design
  checks; duplicate coin retry chose behavioral/concurrency checks and scoped security review.
  Feedback tightened the isolated-test-DB requirement for all integration tests.
- No actual before/after model-token or Plus-quota measurement exists yet. The two scenarios
  validate workflow selection, not execution cost or defect-detection performance.
- Existing app CI gates preserved; added dependency-free agent workflow validation to CI.
  Global plugins and MCP setup unchanged. No timed AI automation enabled.
