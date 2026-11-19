---
name: multitenancy
description: Multi-tenancy enforcement, RLS policies, and tenant isolation patterns. Use when writing any tenant-scoped data access or schema changes.
user-invocable: true
effort: low
agents:
---

# Multi-Tenancy Enforcement

## Critical Rules

1. Every `org_*` query (Prisma, Supabase client, raw SQL, SQL functions, joins, and INSERT/UPDATE/DELETE writes) MUST include `tenant_org_id` directly in the query when the table has that column. RLS, Prisma guard/middleware, or a prior parent lookup are defense in depth only — never a substitute for the explicit predicate. Fetch/update/delete by `id` alone is a violation.
2. Add RLS to new `org_*` tables.
3. Prefer composite foreign keys where they strengthen tenant isolation.
4. Verify tenant handling per module; do not universalize one implementation pattern.

## Module Notes

- `web-admin`: use its centralized tenant-context utilities where applicable
- `cmx-api`: pass tenant context explicitly through NestJS layers
- database: keep RLS and schema-level isolation as defense in depth

## Review Checklist

- every `org_*` query has safe tenant enforcement
- every `org_*` query (prisma or raw SQL ...so on) must have clear direct tenant enforcement by adding `tenant_org_id` to the query if the table has that column
- no cross-tenant leak path
- no stale assumption that Prisma middleware alone solves everything
- no destructive shortcut that bypasses tenant safety

## Related Docs

- `../../docs/multitenancy.md`
- `../../../CLAUDE.md`
