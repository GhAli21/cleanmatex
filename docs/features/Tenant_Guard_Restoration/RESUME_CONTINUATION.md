# Tenant Guard Restoration — Resume

Resume point: Phase 3 apply (STATUS.md). Read in order: [STATUS.md](STATUS.md) (authoritative) → [VIOLATIONS.md](VIOLATIONS.md) → [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Key files

- `web-admin/lib/db/tenant-guard.ts`: evaluation, bypass, recording, the `$extends` extension, and the call-time binding proxy
- `web-admin/lib/db/prisma.ts`: wiring (`buildGuardedClient`)
- `web-admin/lib/db/prisma-performance.ts`: `performanceExtension`
- `web-admin/lib/db/tenant-context.ts`: `withTenantContext` (awaits inside scope)
- `web-admin/scripts/audit-tenant-guard.mjs`: static audit (`npm run audit:tenant-guard`)
- Tests: `__tests__/db/tenant-guard.test.ts`, `__tests__/db-integration/tenant-guard-cross-tenant.db.test.ts`

## Commands (from `web-admin/`)

```bash
npx jest __tests__/db/tenant-guard.test.ts
npx jest --config jest.db.config.js tenant-guard-cross
# discovery run (bash):
TENANT_GUARD_MODE=log TENANT_GUARD_REPORT_FILE=/abs/path/tg.jsonl npx jest --config jest.db.config.js --runInBand
npm run audit:tenant-guard
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .   # default heap OOMs on this repo
```

## Phase 2 fix pattern

```ts
// before
tx.org_x.update({ where: { id }, data })
// after
tx.org_x.update({ where: { id, tenant_org_id: tenantId }, data })
```

`update`/`delete`/`findUnique` accept non-unique fields next to the unique `id` (Prisma ≥5). If the service method doesn't receive `tenantId`, thread it through; don't read it from ALS as a substitute.
