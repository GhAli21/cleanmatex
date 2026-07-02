# Review Prompts

## See Also

- [Prompt Pack Index](./index.md)
- [Reusable Quality Blocks](./reusable-quality-blocks.md)
- [Build Prompts](./build-prompts.md)
- [UI / UX Prompts](./ui-ux-prompts.md)
- [Data / API Prompts](./data-api-prompts.md)
- [Strategy / Evaluation Prompts](./strategy-evaluation-prompts.md)

## 1. Feature Testing Prompt

Use when: A feature exists and you want QA-style validation rather than implementation ideas.

Tip: Ask for `confirmed issues only` if you want stricter, less speculative output.

```md
Your task is to test and validate `[feature name]` in CleanMateX like a senior QA engineer.

Review the implemented behavior against repository rules, business workflows, permissions, tenant isolation, and expected user experience. Do not give generic QA commentary. Produce practical, implementation-ready findings.

Cover:
- functional behavior and happy paths
- edge cases, validation failures, and error handling
- permission checks, RBAC, and route/action/API gating
- tenant isolation and `tenant_org_id` safety
- data integrity, auditability, and side effects
- EN/AR i18n behavior and RTL-safe UI behavior
- loading, empty, disabled, and error states
- UX friction, workflow gaps, and accessibility issues
- regression risks in related flows
- acceptance-criteria coverage
- build, type, lint, and test validation impact where relevant

Required behavior:
- identify real defects, risky assumptions, missing cases, and weak safeguards
- distinguish confirmed issues from suspected risks
- prioritize findings by severity and business impact
- include reproduction steps, expected behavior, and likely affected areas
- call out missing tests that should exist before release

Output should be structured, specific, and suitable for release-readiness review in this repository.
```

## 2. Code Review Prompt

Use when: Code has already been written and you want a pre-merge review.

Tip: This prompt works best when you point to a PR, a diff, or a specific feature area instead of asking for a vague full-repo review.

```md
Your task is to review the `[feature/module/change]` implementation in CleanMateX like a senior code reviewer.

Focus first on correctness, regression risk, tenant safety, maintainability, and repository-rule compliance. Do not give generic praise or high-level commentary. Produce practical findings that help improve the implementation before merge.

Review for:
- functional correctness and business-rule alignment
- regression risks and behavioral changes
- tenant isolation and `tenant_org_id` enforcement
- permission checks, RBAC, and route/action/API gating
- data integrity, auditability, and side effects
- API contract safety and validation completeness
- error handling, loading states, and failure paths
- EN/AR i18n completeness and RTL-safe behavior
- reuse of existing patterns versus unnecessary new abstractions
- build, type, lint, and test implications
- missing tests or weak validation coverage

Required behavior:
- present findings first, ordered by severity
- include file references and concrete explanation of why each issue matters
- distinguish confirmed defects from lower-confidence risks or open questions
- call out repository-rule violations explicitly
- keep summaries brief and secondary to findings
- if no findings are present, say so clearly and mention any residual testing or validation gaps

Output should be structured as an implementation review suitable for pre-merge validation in this repository.
```

## 3. Bug Investigation Prompt

Use when: Something is broken and you want root-cause analysis plus a safe fix direction.

Tip: This is best for real bug work because it forces root-cause thinking instead of symptom-level patching.

```md
Your task is to investigate and fix `[bug name / issue description]` in CleanMateX.

Diagnose the root cause using the current codebase, existing architecture, and repository rules. Do not stop at symptoms or offer generic debugging advice. Prefer the smallest safe fix that resolves the real issue and minimizes regression risk.

Your work should cover:
- symptom summary and affected user/business flow
- likely scope and impacted modules
- root-cause analysis grounded in code evidence
- tenant isolation, permissions, and data-integrity implications
- edge cases and related failure paths
- fix strategy and why it is the safest approach
- validation plan, including targeted tests and regression checks
- follow-up risks or technical debt that should be tracked separately

Required behavior:
- confirm the root cause before proposing broad changes when possible
- preserve backward compatibility unless a behavior change is required
- avoid speculative refactors unrelated to the bug
- call out whether the issue is confirmed, partially confirmed, or still hypothesis-level
- if a migration is needed, create a new migration file only and stop for review
- if the bug affects UI, include loading, empty, error, disabled, and permission-aware states in the check

Output should be structured, evidence-based, and ready for implementation or patch review in this repository.
```

## 4. Gap / Bug Hunt Prompt

Use when: You want a proactive inspection of a feature, module, screen, or flow to uncover bugs, gaps, fragile behavior, and fix-worthy issues even if no single bug is already defined.

Tip: This is different from the Bug Investigation prompt. Use this when the goal is discovery plus safe remediation, not just root-causing one reported bug.

```md
Your task is to inspect `[feature/module/screen/flow]` in CleanMateX for bugs, logic gaps, missing states, validation weaknesses, permission issues, tenant-safety risks, and production fragility, then recommend or implement the safest fixes.

Approach this like a senior engineer performing a targeted stability and correctness sweep. Do not give generic commentary. Focus on real problems, likely failure points, and missing safeguards in this codebase.

Inspect for:
- functional bugs and broken user flows
- edge cases, validation gaps, and error-handling weaknesses
- missing loading, empty, disabled, and error states
- permission, RBAC, and tenant-isolation issues
- data-integrity, auditability, and side-effect risks
- UX friction that can cause user mistakes or support burden
- regression risks and incomplete test coverage
- documentation, contract, or implementation drift where relevant

Required behavior:
- distinguish confirmed bugs from likely risks or suspicious gaps
- prioritize issues by severity, user impact, and production risk
- recommend the smallest safe fixes with the best risk reduction
- call out anything that should be fixed now versus tracked separately
- if asked to fix, preserve backward compatibility unless change is clearly required
- if a migration is needed, create a new migration file only and stop for review

Output should be structured as a targeted gap-and-bug assessment, with implementation-ready fixes where appropriate.
```

## 5. Release Readiness Prompt

Use when: A feature or release slice feels nearly done and you want a go/no-go style assessment.

Tip: This is stronger than a normal QA prompt when you care about rollout completeness, docs, gating, and operational readiness together.

```md
Your task is to assess `[feature/release scope]` for release readiness in CleanMateX.

Review the change set like a senior release-hardening engineer. Focus on what could still block safe rollout, cause regressions, break tenant isolation, confuse users, or leave the implementation operationally incomplete. Do not give generic launch advice.

Assess:
- functional completeness against intended scope
- validation coverage: build, lint, typecheck, tests, and targeted manual checks
- permissions, gating, and tenant isolation safety
- migration readiness and rollout sequencing
- i18n and RTL completeness
- UI state completeness: loading, empty, error, disabled, success
- API contract safety and failure handling
- documentation and operational readiness
- supportability, troubleshooting readiness, and long-term maintenance burden
- regression risk and fallback/rollback considerations

Required behavior:
- identify concrete blockers versus lower-priority follow-ups
- prioritize risks by severity and likelihood
- call out missing validations, missing docs, and missing safeguards explicitly
- keep the output suitable for a go/no-go review

Output should be structured as a release-readiness assessment for this repository.
```

## 6. Performance Review Prompt

Use when: You suspect slow queries, slow screens, heavy rerenders, or scale risks.

Tip: Ask for `measured issues vs likely risks` if you want the answer to separate evidence from hypothesis.

```md
Your task is to review `[feature/screen/API/query]` in CleanMateX for performance risks and optimization opportunities.

Evaluate the implementation using the repository's current architecture, data-access patterns, frontend behavior, and multi-tenant constraints. Do not suggest generic optimization tricks without grounding them in the code path.

Review for:
- expensive queries, missing indexes, and N+1 patterns
- unnecessary rerenders, over-fetching, or duplicate network work
- pagination, filtering, and sorting efficiency
- loading-state UX under slow conditions
- batchability, caching, or async workflow opportunities
- performance impact of tenant scoping, permissions, and joins
- risk of scale issues as data volume or tenant count grows

Required behavior:
- identify concrete bottlenecks and why they matter
- distinguish measured issues from likely-but-unverified risks
- recommend the highest-value improvements first
- avoid suggestions that trade correctness or tenant safety for minor speed gains

Output should be structured, practical, and implementation-ready for this repository.
```

## 7. Security Review Prompt

Use when: You want to inspect a feature for auth, RBAC, tenant isolation, or abuse-case risks.

Tip: This is especially valuable for anything touching data access, privileged actions, payments, settings, or background side effects.

```md
Your task is to review `[feature/module/change]` in CleanMateX for security, tenant safety, and abuse-case risk.

Evaluate the implementation against this repository's auth, RBAC, tenant isolation, validation, auditability, and operational safety expectations. Do not give generic security checklists. Focus on real risks in this codebase.

Review for:
- tenant isolation and `tenant_org_id` enforcement
- permission checks, RBAC, and route/action/API gating
- unsafe data exposure, over-broad queries, or missing filters
- validation gaps and trust-boundary mistakes
- sensitive logging, secret handling, and audit gaps
- dangerous side effects, replay issues, or idempotency gaps
- insecure defaults, escalation paths, or privilege bypasses
- unsafe frontend exposure of gated actions or data

Required behavior:
- prioritize findings by security impact
- explain exploitability or misuse potential clearly
- distinguish confirmed vulnerabilities from defense-in-depth suggestions
- keep recommendations practical and repository-aligned

Output should be structured as a security-focused implementation review for this repository.
```
