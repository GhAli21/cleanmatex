# CleanMateX Database Safety Rules

## Sensitive zones
- schema migrations
- tenant boundaries
- row-level security
- permission tables
- billing / plans
- feature flags
- settings resolution
- seeded master data

## Rules
- no schema changes without approval
- no tenant isolation changes without approval
- no production-impacting SQL without approval
- preserve auditability and deterministic behavior