# Data / API Prompts

## See Also

- [Prompt Pack Index](./index.md)
- [Reusable Quality Blocks](./reusable-quality-blocks.md)
- [Build Prompts](./build-prompts.md)
- [Review Prompts](./review-prompts.md)
- [Strategy / Evaluation Prompts](./strategy-evaluation-prompts.md)

## 1. Migration Design Prompt

Use when: You need to think through schema changes before creating the SQL migration file.

Tip: Use this before writing any migration when the change touches permissions, navigation, backfills, or sensitive relationships.

```md
Your task is to design the database migration plan for `[feature/change]` in CleanMateX.

Produce a repository-safe migration design grounded in current schema conventions, tenant isolation rules, permission seeding rules, and navigation/access requirements where applicable. Do not apply migrations. Design the change so it can be implemented as new migration files only.

Cover:
- tables, columns, constraints, indexes, and relationships
- tenant isolation and `tenant_org_id` implications
- RLS or access-control considerations
- data backfill or compatibility requirements
- permission seed requirements for new permission codes
- navigation seed requirements if UI navigation changes
- rollback and safety considerations
- impact on existing code paths, constants, and API contracts

Required behavior:
- never modify old migrations
- prefer additive, backward-compatible changes unless a breaking change is explicitly required
- align DB-stored codes exactly with TypeScript constants and enums
- identify risky schema choices, dependency risks, and rollout hazards
- if `DROP ... CASCADE` would be needed, flag it as confirmation-required instead of normalizing it

Output should be structured as an implementation-ready migration plan for this repository.
```

## 2. API Contract Prompt

Use when: You want to define the route design and request/response contract before or during implementation.

Tip: This is especially useful when frontend, backend, and permissions questions are entangled and need one clean contract.

```md
Your task is to design the API contract for `[feature/route group]` in CleanMateX.

Create implementation-ready API guidance grounded in current service-layer patterns, validation rules, tenant isolation, permissions, and frontend consumption needs. Do not give generic REST advice. Design contracts that fit this codebase.

Cover:
- route paths and HTTP methods
- request and response shapes
- service-layer responsibilities and boundaries
- authentication and authorization requirements
- permission codes and route/action/API gating implications
- validation rules and error responses
- pagination, filtering, sorting, and query semantics where relevant
- audit, side-effect, and idempotency considerations
- backward compatibility and rollout concerns

Required behavior:
- keep contracts explicit, predictable, and tenant-safe
- align field names and status values with existing repository patterns and DB-mirror rules
- identify places where server actions, background work, or async workflows may be more appropriate
- call out ambiguous contract decisions and recommend the safest option

Output should be structured, specific, and ready for implementation in this repository.
```

## 3. Data Model / ERD Prompt

Use when: You are designing the underlying domain model before locking in migrations and APIs.

Tip: Use this early when statuses, entities, relationships, or reporting requirements are still fuzzy.

```md
Your task is to design the data model and ERD direction for `[feature/domain]` in CleanMateX.

Produce an implementation-ready data-model proposal grounded in current schema conventions, tenant isolation, business workflows, DB-mirror rules, and long-term maintainability. Do not give abstract textbook modeling advice.

Cover:
- entities, responsibilities, and lifecycle states
- table boundaries and relationships
- required fields, codes, statuses, and lookup values
- tenant scoping and composite-key implications where relevant
- audit fields, soft-delete behavior, and activity status
- indexing, integrity constraints, and reporting implications
- compatibility with API contracts, permissions, and workflows
- future extensibility without overengineering

Required behavior:
- align DB-stored values exactly with intended constants and enums
- identify risky modeling choices, duplication, or coupling early
- recommend the simplest model that supports the business rules cleanly
- call out any migration or backfill implications explicitly

Output should be structured, specific, and ready to guide schema implementation in this repository.
```
