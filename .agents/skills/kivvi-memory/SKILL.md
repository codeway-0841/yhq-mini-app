---
name: kivvi-memory
description: Maintain concise KIVVI decisions and resumable task handoffs after a meaningful milestone or when switching chats.
---

# KIVVI memory

Use docs/agent-context/memory.md for durable decisions, each with date, evidence/source path
and revisit condition. Update an existing decision instead of appending duplicates.
Keep it below 120 lines; move superseded details to the appropriate domain reference only if useful.
Never store secrets, tokens, private data, full logs, speculative facts or conversation transcripts.

For an unfinished task, create/update `.agent-local/handoff.md` with:
- Goal and acceptance condition.
- Current branch/commit and owned files (re-read Git before resuming).
- Confirmed decisions and unresolved questions.
- Checks actually run, result and local log paths.
- Next concrete action and external side effects already authorized.

Keep the handoff below 60 lines. Mark finished tasks complete and remove stale next actions.
On resume, read the handoff and check file/Git state; do not re-run completed discovery without cause.
Local handoffs and logs are ignored by Git. Durable decisions are reviewable repository files.
Do not create a new memory entry for every message. Never present saved state as live verification.
