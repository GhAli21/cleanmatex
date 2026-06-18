---
name: feature-implementation
description: Implement a scoped feature with minimal risk and minimal diff
---

# Purpose
Use this skill when implementing a focused feature or enhancement.

# Steps
1. Understand the requested feature clearly.
2. Identify exact insertion points and affected files.
3. Reuse existing components, hooks, services, and patterns first.
4. Implement only the minimum required change set.
5. Preserve current contracts unless explicitly asked to change them.
6. Add or adjust validation and edge-state handling if directly relevant.
7. Run relevant validation:
   - lint (`cd web-admin && npx eslint . --quiet` for error-only gate)
   - typecheck
   - targeted tests
   - build if affected
8. Return:
   - summary
   - files changed
   - validation results
   - remaining risks

# Rules
- Do not refactor unrelated areas.
- Do not introduce dependencies without approval.
- Do not modify infra, secrets, or migrations.
- Keep the diff surgical.
- **React lint:** follow `docs/dev/rules/react-lint-verification-checklist.md`, `react-effects-patterns.md`, `react-rhf-and-table-lint.md` — `npx eslint . --quiet` before done; `useWatch` not `form.watch`; no `setState` in `useEffect`; `next/link` for internal routes