# Prompt Examples Gallery

Use this file when you want ready-to-paste prompt examples for common CleanMateX scenarios.

## How To Use

- Copy the closest example.
- Replace placeholders with the real scope.
- Add one quality block or one to two add-on lines only if needed.
- Still apply the relevant repo skills such as `/frontend`, `/backend`, `/database`, `/i18n`, `/multitenancy`, `/implementation`, or `/documentation`.

## Example 1: New Feature Planning

```md
Your task is to design the full `order credit wallet` feature end-to-end for CleanMateX.

Produce implementation-ready output grounded in this repository's existing architecture, conventions, and constraints. Reuse current patterns before introducing new ones. Do not give generic advice or greenfield SaaS recommendations.

Cover business rules, workflow states, database changes, API contracts, permissions, tenant isolation, auditability, UI screens, EN/AR requirements, and implementation roadmap.

Do not write code yet; produce the implementation blueprint first.
```

## Example 2: Feature Execution

```md
Your task is to design and implement the full `customer wallet transaction history` feature end-to-end for CleanMateX.

First, produce a concise implementation plan grounded in existing repository patterns. Then implement the approved scope with production-oriented changes that respect tenant isolation, service-layer boundaries, Cmx UI rules, and EN/AR parity.

Run the required validations before finishing.
```

## Example 3: Known Bug Investigation

```md
Your task is to investigate and fix `double payment submission in order collect payment flow` in CleanMateX.

Diagnose the root cause using the current codebase and repository rules. Prefer the smallest safe fix that resolves the real issue and minimizes regression risk.

Focus on idempotency, payment side effects, auditability, permission-aware actions, and regression checks.
```

## Example 4: Proactive Gap / Bug Hunt

```md
Your task is to inspect `order submit flow` in CleanMateX for bugs, logic gaps, missing states, validation weaknesses, permission issues, tenant-safety risks, and production fragility, then recommend the safest fixes.

Approach this like a senior engineer performing a targeted stability and correctness sweep. Distinguish confirmed bugs from likely risks and prioritize issues by severity and production impact.
```

## Example 5: Code Review

```md
Your task is to review the `wallet settlement and voucher allocation` implementation in CleanMateX like a senior code reviewer.

Focus first on correctness, regression risk, tenant safety, maintainability, and repository-rule compliance.

Present findings first, ordered by severity. Include file references and call out any missing tests, permission gaps, or contract risks.
```

## Example 6: UI / UX Design

```md
Your task is to design a premium, modern, responsive SaaS UI/UX for `customer wallet ledger screen` in CleanMateX.

Create implementation-ready UI guidance grounded in this repository's existing design system, layout patterns, and frontend constraints.

Cover layout, table behavior, filters, loading/empty/error states, mobile responsiveness, EN/AR behavior, RTL-safe layout, and permission-aware UI states.
```

## Example 7: Existing Screen UX Review

```md
Your task is to review the `order payment modal` screen in CleanMateX and recommend better UI/UX with implementation-ready guidance.

Evaluate the screen for hierarchy, workflow clarity, responsiveness, missing states, accessibility, visual consistency with Cmx patterns, and operational efficiency.

Findings first, summary second.
```

## Example 8: API Contract Design

```md
Your task is to design the API contract for `wallet transactions and wallet settlement routes` in CleanMateX.

Create implementation-ready API guidance grounded in current service-layer patterns, validation rules, tenant isolation, permissions, and frontend consumption needs.

Cover route paths, request and response shapes, auth requirements, pagination, filtering, error responses, and idempotency considerations.
```

## Example 9: Migration Design

```md
Your task is to design the database migration plan for `customer wallet ledger and allocation tracking` in CleanMateX.

Produce a repository-safe migration design grounded in current schema conventions, tenant isolation rules, permission seeding rules, and backward-compatible rollout.

Do not apply migrations. Design the change so it can be implemented as new migration files only.
```

## Example 10: Multi-Perspective Evaluation

```md
Your task is to evaluate `customer overpayment to wallet flow` in CleanMateX from multiple professional perspectives and provide a balanced, implementation-ready assessment.

Review it through the following lenses where applicable to this specific scope:
- finance and revenue impact
- accounting correctness and auditability
- end-user usability and workflow clarity
- operations and staff efficiency
- tenant admin and manager control needs
- security, permissions, and tenant isolation
- product scalability and long-term maintainability
- API, data-model, and reporting consistency
- implementation complexity, rollout risk, support burden, and production readiness

For each applicable perspective, assess what is strong, what is risky, what is missing, what conflicts with another perspective, and what should change before release.
```

## Example 11: Release Readiness

```md
Your task is to assess `wallet settlement release scope` for release readiness in CleanMateX.

Review the change set like a senior release-hardening engineer. Focus on what could still block safe rollout, cause regressions, break tenant isolation, confuse users, or leave the implementation operationally incomplete.

Assess build/test readiness, permission safety, migration sequencing, UI state completeness, supportability, and rollback risk.
```

## Example 12: Documentation Prompt

```md
Your task is to create or update the documentation for `customer wallet ledger feature` in CleanMateX.

Write implementation-ready documentation grounded in this repository's actual behavior, architecture, and rules.

Cover feature scope, business rules, permissions, navigation, API routes, migrations, UI states, i18n, testing, rollout notes, and known risks.
```
