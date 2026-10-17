# Agent workflow operations

## Use

New chats in this project read the shorter AGENTS.md. Skills live in .agents/skills:
`$kivvi-qa` for QA, `$kivvi-memory` for handoff/decisions, `$kivvi-workflow` for multi-file planning.
Their narrow descriptions allow normal discovery; existing installed skills remain available.
The QA role is in .codex/agents/kivvi-qa.toml using the same format as the existing roles.
Start a new project chat if skill/role discovery has not refreshed; current tool catalogs may be fixed.
Fallback: invoke the QA skill in the main agent, without creating a helper.

## Deterministic automation

`node scripts/agent-check.mjs --help` lists bounded check commands. It makes no model requests.
Logs stay in ignored .agent-local/checks; successful output is a single metrics line.
Failures print bounded diagnostics and preserve the failing exit status. Read more from the log
only if the excerpt does not identify the failure. Test paths must be existing exact unit files.
Use existing CI for lint, types, API/unit, builds and E2E. No scheduled model jobs were added.

## Measurement and limits

Run `node scripts/agent-context-audit.mjs` to compare startup instruction characters.
This is a reproducible context-size metric, not a claim about billable tokens or Plus quotas.
For two representative real tasks (small UI change and behavioral bugfix), record:
task/commit, model and effort, actual usage if exposed, tool calls, captured output bytes,
elapsed time, checks and remaining defects. Compare equivalent tasks/settings; never invent
before/after model usage. Do not spend quota rerunning a whole task purely to manufacture a baseline.
Existing long chat history is not erased by editing files. Begin the next task in a fresh chat
with a concise handoff when needed. App/global plugin instructions remain outside this repo's control.

## Rollback

The prior root instructions are preserved in three ordered references: architecture.md,
backend.md, design.md. Their content was split at headings without deleting rules.
Restore from Git or concatenate these sections if a full root document is intentionally wanted.
New skills and QA role are additive; existing agent roles and MCP services are untouched.
CI has one added dependency-free agent workflow validation step; existing gates are preserved.
Inspect dated reference rules against current code (for example removed features) before applying them.
