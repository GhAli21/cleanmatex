---
name: multitenancy
description: Multi-tenancy enforcement, RLS policies, and tenant isolation patterns. Use when writing any tenant-scoped data access or schema changes.
user-invocable: true
---

# Multi-Tenancy Enforcement

## Critical Rules

1. Always enforce `tenant_org_id` for tenant-scoped data.
2. Add RLS to new `org_*` tables.
3. Prefer composite foreign keys where they strengthen tenant isolation.
4. Verify tenant handling per module; do not universalize one implementation pattern.

## Module Notes

- `web-admin`: use its centralized tenant-context utilities where applicable
- `cmx-api`: pass tenant context explicitly through NestJS layers
- database: keep RLS and schema-level isolation as defense in depth

## Review Checklist

- every `org_*` query has safe tenant enforcement
- no cross-tenant leak path
- no stale assumption that Prisma middleware alone solves everything
- no destructive shortcut that bypasses tenant safety

## Related Docs

- `../../docs/multitenancy.md`
- `../../../CLAUDE.md`
