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