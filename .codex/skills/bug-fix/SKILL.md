---
name: bug-fix
description: Diagnose and fix a scoped bug with minimal regression risk
---

# Purpose
Use this skill for production-safe bug fixing.

# Steps
1. Reproduce the issue if possible.
2. Trace the issue to root cause.
3. Confirm the actual failing logic or boundary.
4. Implement the smallest correct fix.
5. Check for adjacent regressions and edge cases.
6. Run relevant validation:
   - lint
   - typecheck
   - targeted tests
   - build if needed
7. Return:
   - root cause
   - summary of fix
   - files changed
   - validation results
   - remaining risks

# Rules
- Fix root cause, not cosmetic symptoms.
- Do not rewrite the surrounding module unless necessary.
- Keep changes tightly scoped.