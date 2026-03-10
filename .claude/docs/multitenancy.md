# Multi-Tenancy Rules

## Authority Note

This is supporting guidance. When implementation details differ, prefer:

- `CLAUDE.md`
- current module READMEs
- current code

## Core Rules

1. Every tenant-scoped query must enforce `tenant_org_id`.
2. Every new tenant-scoped table should use RLS.
3. Composite foreign keys should be used where they materially protect tenant isolation.
4. Never assume one module's tenant-context implementation automatically applies to another module.

## Module-Specific Reality

- `web-admin` may use centralized tenant-context helpers where implemented
- `cmx-api` should pass tenant context through NestJS request/guard/service boundaries
- Supabase queries still need explicit tenant awareness unless RLS and the runtime path guarantee it

## Review Checklist

- no missing tenant filter on `org_*` queries
- no cross-tenant join risk
- no misleading universal Prisma-middleware assumption
- no duplicated tenant-context helpers when a centralized module helper already exists for that module

## Related Docs

- `../skills/multitenancy/SKILL.md`
- `../../CLAUDE.md`
