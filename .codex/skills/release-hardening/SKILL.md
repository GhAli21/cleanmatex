---
name: release-hardening
description: Harden a feature or area before release
---

# Purpose
Use this skill when a feature is considered complete and needs a final quality pass.

# Checklist
- loading states
- empty states
- error handling
- success messaging
- validation gaps
- edge cases
- type safety
- logging / observability touchpoints if relevant
- responsive behavior
- i18n consistency
- permission / role checks
- tenant safety
- query / mutation failure handling

# Steps
1. Inspect the changed area.
2. Identify missing states or weak spots.
3. Implement only the necessary hardening changes.
4. Run:
   - lint
   - typecheck
   - targeted tests
   - build
5. Return:
   - hardening improvements made
   - files changed
   - validation results
   - unresolved concerns

# Rules
- Do not turn hardening into a broad rewrite.
- Keep changes focused on release readiness.