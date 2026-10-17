---
name: kivvi-qa
description: Select and run risk-based KIVVI regression checks for a changed feature, bug fix or release; produce evidence with compact logs.
---

# KIVVI QA

Work from the requested behavior and actual changed files, including untracked files in scope.
Record the acceptance condition and risk, then choose checks below. Do not treat a green
command as proof of a behavior it does not exercise. Do not broaden a review into implementation.
All database integration tests require an explicit isolated test DB; check/migrate its schema
first. Never use production credentials or production fixtures, including for concurrency tests.

| Change | Minimum evidence |
| --- | --- |
| Text/style only | Affected mobile state; overflow, readable text, dark/light when affected; existing design guards |
| Component/state | Targeted Vitest behavior tests + frontend types; focus/close/back for dialogs |
| Shared CSS/shell | Design/safe-area/import guards + affected navigation/modal tests + mobile visual check |
| API/auth | Backend types + handler/validation/auth tests; denied user, malformed input and recovery |
| Coins/payments/scoring | Replay, concurrent claims, authorization and ledger invariants; independent security review if material |
| Schema | Migration journal/snapshot checks; explicit isolated test DB integration; rollback/recovery reasoning |
| Release/shared infrastructure | Existing CI gates and relevant E2E; platform build only when in scope |

1. Locate existing tests with rg; choose exact paths. Read the applicable domain reference from AGENTS.md.
2. For a behavioral fix, add the smallest test showing the old failure and corrected behavior.
   Avoid tests that merely search source strings unless an architectural invariant requires it.
3. Run `node scripts/agent-check.mjs unit <test-path> ...` or its typecheck/build modes.
   It preserves exit status and writes full logs locally. On failure read the failing section,
   then rerun the affected check. Do not print the full log by default.
4. Use the connected browser for visual acceptance. CLI Playwright is for existing automated tests.
   Never bypass login, alter production data or fake successful responses to get a screenshot.
5. Stop after the selected checks pass. A new change invalidates only relevant earlier evidence.
   Full suites run for broad shared changes or releases, not on every wording edit.

Return: PASS/FAIL/PARTIAL, behavior checked, exact commands and exit codes, concrete failures,
and skipped coverage with reason. Distinguish local verification from CI/deployment.
An unavailable DB/browser is a coverage gap, never a pass. Tests passing is not proof of total correctness.
