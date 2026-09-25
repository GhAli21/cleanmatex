# Prisma Configuration Guide (web-admin)

Module-local guidance. Package docs: `docs/features/Tenant_Guard_Restoration/`.

> **Changed 2026-09-25.** Earlier versions of this file said a Prisma middleware added
> `tenant_org_id` automatically. It never ran: `$use` does not exist on Prisma 6, so the
> middleware was silently skipped. It has been removed. **Nothing adds tenant filters for you.**

## Architecture

| Piece | File | What it does |
|---|---|---|
| Prisma client | `lib/db/prisma.ts` | Singleton base client + extensions. Import `prisma` from here only. |
| Tenant Guard | `lib/db/tenant-guard.ts` | `$extends` query extension: checks each query on a tenant-scoped model carries an explicit `tenant_org_id`. **Logs or rejects, never injects.** |
| Call-site binding | `withTenantGuardCallsites` in `tenant-guard.ts` | Binds each lazy query to the line/async context that created it, so violations name the real file:line. |
| Performance monitor | `lib/db/prisma-performance.ts` | `$extends` query-timing extension (feeds `/api/admin/prisma-performance`). |
| Tenant context | `lib/db/tenant-context.ts` | `withTenantContext(tenantId, fn)` stores the tenant in AsyncLocalStorage. Used by the guard to detect queries naming a *different* tenant. It does not filter anything. |

`lib/prisma.ts` is a deprecated re-export; import from `@/lib/db/prisma`.

## The rule

Every query on a model that has a `tenant_org_id` column (and `org_tenants_mst`, guarded on `id`) must constrain it explicitly:

```typescript
// ✅ scoped
await prisma.org_orders_mst.findFirst({ where: { id: orderId, tenant_org_id: tenantId } });
await prisma.org_orders_mst.findUnique({ where: { id_tenant_org_id: { id: orderId, tenant_org_id: tenantId } } });
await prisma.org_orders_mst.update({ where: { id: orderId, tenant_org_id: tenantId }, data: { ... } });
await prisma.org_orders_mst.create({ data: { tenant_org_id: tenantId, ... } });

// ❌ violation (MISSING_TENANT_FILTER) — a by-id lookup can return another tenant's row
await prisma.org_orders_mst.findUnique({ where: { id: orderId } });
```

Accepted forms: top-level `tenant_org_id` (value, `equals`, non-empty `in`), inside `AND`, inside a compound unique key, or in **every** `OR` branch. `NOT`/`notIn`/relation filters do not count. `create`/`createMany` need it on every row; `upsert` needs it in `where` and `create`.

Inside `withTenantContext(A)`, a query naming tenant B is a `TENANT_MISMATCH` violation.

## Modes — `TENANT_GUARD_MODE`

| Value | Behavior |
|---|---|
| `log` (current default, Phase 1–2) | `console.warn` once per model+operation+callsite; query runs. |
| `enforce` (Phase 3 default) | Throws `TenantGuardViolationError` before the query reaches the DB. |

`TENANT_GUARD_REPORT_FILE=<path>` appends each violation as JSONL (used for discovery runs).

## Legitimate cross-tenant work

Platform sweeps / outbox processors / seeding that must span tenants:

```typescript
import { withTenantGuardBypass } from '@/lib/db/tenant-guard';

await withTenantGuardBypass('finance-outbox-sweep', () =>
  prisma.org_fin_outbox_tr.findMany({ where: { status: 'PENDING' } })
);
```

Every bypass reason must be listed in `docs/features/Tenant_Guard_Restoration/STATUS.md`.

## Not covered by the guard

- **Raw SQL** (`$queryRaw` / `$executeRaw`) cannot be inspected — write `WHERE tenant_org_id = ...` yourself. The static audit flags suspects.
- **Nested writes** (`create: { items: { create: [...] } }`) are only checked at the top level.
- **Supabase-client routes** rely on RLS, not on this guard. Prisma connects as a superuser, so RLS does **not** protect Prisma queries.

## Commands

```bash
npm run audit:tenant-guard                                   # static worklist → docs/.../generated/STATIC_AUDIT.md
TENANT_GUARD_MODE=enforce npm run test:db-integration        # real-DB proof incl. tenant-guard-cross-tenant.db.test.ts
npm run prisma:generate
npx tsx scripts/test-prisma-connection.ts
```

## Typing note

`prisma` is typed as plain `PrismaClient` on purpose: both extensions are query-only, and exposing the inferred extended type made `tsc` ~5x slower and broke every injected `PrismaClient` parameter.
