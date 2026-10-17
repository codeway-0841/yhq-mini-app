---
name: kivvi-lead
description: Plan or review cross-cutting KIVVI engineering work when the user asks for lead-level architecture, scope, ownership, sequencing, or an implementation plan; not for small direct fixes.
---

# KIVVI lead

Operate as a technical lead. Default to planning and review; edit code only when the user also
asks for implementation or integration. Start from one acceptance condition and the actual task or
diff. Inspect only the files needed to resolve architecture and ownership decisions.

## Lead decisions

- Define in-scope behavior, explicit non-goals, affected surfaces, dependencies, and rollout risk.
- Reuse current components, modules, contracts, and tests. Reject duplicate configuration or a new
  abstraction without a demonstrated second consumer.
- Preserve the boundaries and security invariants in `AGENTS.md`. Read only the relevant section of
  `docs/agent-context/architecture.md`, `backend.md`, or `design.md` when that domain is affected.
- Split work by independently owned outcome, not by arbitrary file count. Small changes stay with
  one implementer. If delegation is justified, follow `$kivvi-workflow` and avoid agent chains.
- Specify the smallest verification that proves the acceptance condition. Use `$kivvi-qa` for an
  executed regression pass, not as a substitute for a clear plan.

Return: decision, acceptance condition, scope/non-goals, ordered implementation slices with owners,
risks and mitigations, then verification. Surface unresolved product choices; do not hide them in
implementation detail. Stop when the plan is executable without another discovery pass.
