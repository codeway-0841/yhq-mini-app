---
name: kivvi-workflow
description: Plan bounded KIVVI implementation and selective agent delegation for multi-file features or ambiguous investigations.
---

# KIVVI workflow

Start with one acceptance condition, scope and risk. Reuse existing code and tests.
Small direct fixes stay with the main agent. Delegate only when a concrete independent question
or owned implementation slice avoids repeated exploration. Default to one helper; no agent chains.

Existing roles: bug-hunter for investigation, senior-code-reviewer for behavior/architecture,
security-auditor for auth/payments/scoring, test-generator for test implementation.
Use kivvi-qa for project checks. Do not create duplicate roles or start the whole roster.
If a role is not loaded in the current runtime, give its short instructions to a default agent;
do not claim its installed file is an active process.

Delegation brief: outcome; exact owned files; evidence already found; boundaries; expected output.
Avoid full conversation forks. Tell editing agents they share the checkout and must preserve others' work.
Use short final reports: finding + file:line + trigger + check, or changed files + test results.
The main agent owns integration and final evidence; avoid rereading every delegated file without cause.

Tools: rg/Git for localization; existing Vitest/TypeScript/ESLint for checks; connected browser
for visible UI; existing CI for broad validation; Context7/official docs for uncertain APIs.
Do not add services, API keys, paid model calls or scheduled AI runs merely to automate shell checks.

After two failed approaches, summarize the exact blocker and try a materially different diagnosis.
Stop when acceptance and risk-appropriate checks are satisfied; do not add speculative improvements.
Use kivvi-memory only when a durable decision or handoff exists. Save logs with agent-check.
