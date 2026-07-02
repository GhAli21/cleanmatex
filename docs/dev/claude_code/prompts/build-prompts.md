# Build Prompts

## See Also

- [Prompt Pack Index](./index.md)
- [Reusable Quality Blocks](./reusable-quality-blocks.md)
- [Review Prompts](./review-prompts.md)
- [Data / API Prompts](./data-api-prompts.md)
- [UI / UX Prompts](./ui-ux-prompts.md)
- [Strategy / Evaluation Prompts](./strategy-evaluation-prompts.md)

## 1. Feature Planning Prompt

Use when: You want an implementation blueprint before any code is written.

Tip: This works best when you want business rules, data model, API, permissions, UI, and rollout thought through together before execution starts.

```md
Your task is to design the full `[feature name]` feature end-to-end for CleanMateX.

Produce implementation-ready output grounded in this repository's existing architecture, conventions, and constraints. Reuse current patterns before introducing new ones. Do not give generic advice or greenfield SaaS recommendations.

Cover all relevant areas:
- business rules and workflow states
- user journeys and operational flows
- database changes and migration requirements
- API routes, service layer responsibilities, and request/response contracts
- permissions, RBAC, and route/action gating
- tenant isolation and `tenant_org_id` filtering
- validations, error states, empty states, and edge cases
- audit logs, notifications, and downstream side effects
- UI screens, forms, tables, dialogs, and user feedback states
- EN/AR i18n requirements and RTL impact
- feature flags, settings, plan limits, and navigation impacts
- rollout order, dependencies, risks, and implementation roadmap

Required behavior:
- identify gaps, hidden requirements, conflicting rules, and risky assumptions
- call out better alternatives when the obvious approach has long-term cost
- preserve backward compatibility unless change is explicitly required
- keep solutions modular, tenant-safe, auditable, and maintainable
- align constants, permission codes, and DB values exactly with repository rules
- if database changes are needed, create new migration files only and never modify old migrations
- if navigation or permissions change, include the required dual-write and migration implications
- if frontend is involved, use Cmx components only and include i18n keys

Do not write code yet; produce the implementation blueprint first.
Output in a structured, implementation-ready format suitable for building a real enterprise multi-tenant SaaS feature in this repo.
```

## 2. Feature Execution Prompt

Use when: You want planning plus implementation in one request.

Tip: Add `Wait for my approval before writing code.` if you want the plan first without immediate coding.

```md
Your task is to design and implement the full `[feature name]` feature end-to-end for CleanMateX.

First, produce a concise implementation plan grounded in this repository's existing architecture, conventions, and constraints. Reuse current patterns before introducing new ones. Do not give generic advice or greenfield SaaS recommendations.

Then implement the approved scope with production-oriented changes that respect repository rules, especially:
- tenant isolation and `tenant_org_id` filtering
- service-layer boundaries
- new migration files only; never modify old migrations
- Cmx components only for frontend work
- EN/AR i18n parity and RTL-safe behavior
- permission, navigation, and gating requirements when applicable

Cover all relevant areas:
- business rules and workflow states
- database changes and migration requirements
- API routes, service responsibilities, and request/response contracts
- permissions, RBAC, and route/action/API gating
- validations, edge cases, error states, and empty states
- audit logs, notifications, and downstream side effects
- UI screens, forms, tables, dialogs, and feedback states
- feature flags, settings, plan limits, and navigation impacts

Required behavior:
- identify gaps, hidden requirements, risky assumptions, and better alternatives
- preserve backward compatibility unless change is explicitly required
- keep changes scoped, reviewable, maintainable, and auditable
- run the required validations for the affected area before finishing
- report any blockers, risks, or follow-up work clearly

After the design is clear, implement the scoped changes and run the required validations.
```

## 3. Refactor Prompt

Use when: You want structural cleanup without changing intended behavior.

Tip: Add `minimal diff` if you want the answer to optimize for low churn and easier review.

```md
Your task is to refactor `[module/component/service/flow]` in CleanMateX safely.

Improve structure, clarity, reuse, or maintainability without changing intended behavior unless an explicit fix is required. Ground the refactor in the current repository architecture and patterns. Do not introduce speculative redesigns.

Focus on:
- preserving existing behavior and contracts
- reducing duplication and clarifying responsibilities
- improving readability, composability, and testability
- aligning with existing service, feature, and UI patterns
- maintaining tenant isolation, permission behavior, and auditability
- avoiding churn outside the scoped area

Required behavior:
- state the target scope and refactor intent clearly
- call out any areas where behavior might accidentally change
- prefer the smallest safe structural improvement that meaningfully helps
- preserve backward compatibility unless change is explicitly required
- run the relevant validations for the touched area before finishing

Output should be structured, implementation-ready, and optimized for low regression risk in this repository.
```

## 4. Continue Existing Work Prompt

Use when: Work is already in progress and you want to resume safely without assuming the current state is correct.

Tip: This is especially useful after context switching, handoffs, partial implementations, or interrupted sessions.

```md
Your task is to continue the in-progress `[feature/workstream]` in CleanMateX safely and efficiently.

First, inspect the current codebase state and compare it against the intended scope, PRD, or implementation plan. Do not assume the previous work is complete or correct. Reconstruct the current state from repository evidence before deciding the next steps.

Your work should cover:
- what is already implemented
- what is partially implemented or inconsistent
- what remains to be done
- any regressions, blockers, or rule violations already present
- the safest next implementation sequence
- validation steps needed before and after further changes

Required behavior:
- verify the real current state before proposing continuation steps
- preserve backward compatibility unless change is explicitly required
- call out drift between plan, code, migrations, docs, and UI behavior
- prefer completing the smallest coherent next slice rather than reopening everything

Output should be structured as a continuation plan or implementation-ready next-step guide for this repository.
```
