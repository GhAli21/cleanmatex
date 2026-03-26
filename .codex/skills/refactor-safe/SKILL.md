---
name: refactor-safe
description: Refactor a bounded area without changing behavior
---

# Purpose
Use this skill when improving maintainability in a limited scope.

# Steps
1. Define the exact refactor boundary.
2. Confirm expected behavior remains unchanged.
3. Identify duplication, weak naming, or structural issues in that boundary.
4. Refactor conservatively.
5. Preserve interfaces unless explicitly approved to change them.
6. Run relevant validation:
   - lint
   - typecheck
   - targeted tests
   - build if affected
7. Return:
   - refactor objective
   - files changed
   - behavior preserved
   - validation results
   - any follow-up suggestions

# Rules
- No broad architecture rewrites.
- No style-only churn across unrelated files.
- No dependency changes without approval.
- Keep refactors reviewable.