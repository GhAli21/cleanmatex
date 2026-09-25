# Tenant Guard Restoration — Resume

**Resume point (2026-09-25):** Phase 2 done (`bfa5917`). Work moved to the owner's laptop. Start with the **"Next (in order, on the laptop)"** list in [STATUS.md](STATUS.md): local verification, then Phase 3 apply, PR, rollout.

Read in order: [STATUS.md](STATUS.md) (authoritative) → [VIOLATIONS.md](VIOLATIONS.md) (closed worklist + raw-SQL verdicts) → [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Key files

- `web-admin/lib/db/tenant-guard.ts`: evaluation, bypass, recording, the `$extends` extension, the call-time binding proxy, and `getTenantGuardMode()` (Phase 3 edit goes here)
- `web-admin/lib/db/prisma.ts`: wiring (`buildGuardedClient`)
- `web-admin/lib/db/prisma-performance.ts`: `performanceExtension`
- `web-admin/lib/db/tenant-context.ts`: `withTenantContext` (awaits inside scope)
- `web-admin/scripts/audit-tenant-guard.mjs`: static audit (`npm run audit:tenant-guard`); statuses MISSING / REVIEW / BYPASS / OK
- Registered bypasses: `lib/services/gateway-webhook.service.ts` (`gateway-webhook-intake`), `lib/services/order-lock.service.ts` (`order-edit-locks-expiry-sweep`)
- Tests: `__tests__/db/tenant-guard.test.ts`, `__tests__/db-integration/tenant-guard-cross-tenant.db.test.ts`, `__tests__/services/gateway-webhook.service.test.ts` (scoping cases)

## Commands (from `web-admin/`)

PowerShell (laptop):

```powershell
npm run prisma:generate
$env:NODE_OPTIONS="--max-old-space-size=12288"; npx tsc --noEmit -p .
npx jest __tests__/db/tenant-guard.test.ts
npm run test:db-integration
# discovery run with a report file:
$env:TENANT_GUARD_MODE="log"; $env:TENANT_GUARD_REPORT_FILE="F:\jhapp\cleanmatex\tg.jsonl"; npx jest --config jest.db.config.js --runInBand
npm run audit:tenant-guard
npm run build
```

## Rules for new code (unchanged)

```ts
// before
tx.org_x.update({ where: { id }, data })
// after
tx.org_x.update({ where: { id, tenant_org_id: tenantId }, data })
```

`update`/`delete`/`findUnique` accept non-unique fields next to the unique `id` (Prisma ≥5). If the service method doesn't receive `tenantId`, thread it through; don't read it from ALS as a substitute. A genuinely cross-tenant job uses `withTenantGuardBypass('<reason>', …)` and gets a row in the STATUS bypass register in the same PR.
