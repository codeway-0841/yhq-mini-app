---
name: task-auditor
description: Read-only audit of a KIVVI task or its current implementation when the user asks to audit, review, or check a task with minimal token use.
---

# Task auditor

Audit only; do not implement fixes unless the user separately asks for implementation.
Choose the mode from the request:

- Before implementation: test task clarity, acceptance condition, scope, dependencies, risks, and the smallest verification plan.
- After implementation: inspect the relevant diff and test correctness, regressions, architecture invariants, security boundaries, and missing coverage.

## Token discipline

Start from the task text and one acceptance condition. Use targeted `rg`, `git diff --stat`,
and narrow line excerpts. By default, stop after three focused searches and six relevant file
excerpts. Expand only for a concrete high-risk lead, and state why. Do not read full logs, bundles,
databases, broad reference sets, or the whole repository. Do not spawn agents or browse docs unless
the task has a genuinely version-sensitive dependency. Do not run full builds or test suites during
the audit; name the smallest useful checks instead.

Treat repository evidence as stronger than assumptions. Do not invent exact token counts when no
telemetry exists. Mark an unverified concern as `unknown`, not as a defect. Stop when every reported
finding has evidence or when no high-confidence finding remains.

## Output

Keep the report compact:

1. `Verdict`: ready, needs clarification, or changes required.
2. `Findings`: only actionable items, ordered P0 to P2, each with `file:line` or task-text evidence,
   trigger/impact, and the smallest fix. Say `No findings` when appropriate.
3. `Minimal verification`: only checks justified by the affected surface.
4. `Unknowns`: only blockers that evidence could not resolve.

Do not repeat the task, narrate searches, praise unaffected code, or add speculative improvements.
