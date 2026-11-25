---
name: code-review
description: Review a change critically for correctness, maintainability, and risk
---

# Purpose
Use this skill to review existing changes or diffs before accepting them.

# Review checklist
- correctness
- regressions
- edge cases
- type safety
- data flow integrity
- duplicated logic
- architecture consistency
- readability / maintainability
- validation completeness
- tenant / auth / permission safety
- API contract safety
- money-field behavior safety (`docs/dev/rules/no-silent-money-mutation.md`)
- time and timezone (`docs/dev/rules/time-and-timezone.md`): instants are UTC, civil dates are stored as dates, operational UI uses the feature's documented scope, then the organization zone. Order acceptance uses the receiving branch. A ready-by promise uses the fulfilment branch. A POS session uses the till's branch. A delivery appointment uses the service location. An invoice uses the issuing legal entity. When that scope has no valid zone, use the organization zone. A client-supplied zone is an echo only.
- UI design system (`docs/dev/rules/cmx-design-system.md`; for a full UI pass use the `cmx-ui-design-review` skill and `npm run check:ui`)
- UI state handling:
  - loading
  - empty
  - error
  - success

# Output
Return:
1. overall assessment
2. specific findings by severity
3. risky files or behaviors
4. missing validation
5. recommended next actions

# Rules
- Do not modify files unless explicitly asked.
- Be critical and concrete.
- Prefer actionable findings over vague commentary.
- Flag any silent mutation of a user-editable money field as a correctness issue.
