# Changelog — Tenant Guard Restoration

## 2026-09-25 — Step 0 + Phase 1 discovery

- Added the `$extends` Tenant Guard (`lib/db/tenant-guard.ts`): log/enforce modes, `TENANT_MISMATCH` detection, `withTenantGuardBypass`, JSONL reporting, and call-time callsite/context binding.
- Ported the performance monitor to `$extends` (it was also dead under `$use`).
- Removed the dead `$use` tenant middleware and its two tests.
- `withTenantContext` now awaits inside its scope. This fixes lost tenant context for lazily returned Prisma queries.
- Added unit tests (28), a real-DB cross-tenant test (9), a static audit script with an npm script, and a rewritten `lib/db/PRISMA_SETUP.md`.
- Phase 1 output: [VIOLATIONS.md](VIOLATIONS.md).

## 2026-09-25 — Phase 2 (query fixes)

- Static model MISSING 113 → 0. REVIEW entries hand-verified (2 real misses fixed). Every raw-SQL suspect has a verdict (1 fixed: ERP posting-log update).
- Outbox: `markProcessed(eventId, tenantId)`, `markFailed(eventId, tenantId, error)`, `scheduleRetry(eventId, tenantId, attempts)`. Scoped by the claimed row's tenant.
- Gateway webhook: pre-resolution intake runs under the registered bypass `gateway-webhook-intake`; tenant is stamped once (`tenant_org_id: null` guard); later writes are scoped; no leg probe without provider ids.
- Order locks: all per-order calls scoped; `cleanupExpiredLocks()` runs under the registered bypass `order-edit-locks-expiry-sweep`.
- `updateInvoiceWithFinancialSnapshot(tx, tenantId, invoiceId, breakdown)` (signature change; no callers).
- DB fixtures in 3 cash-drawer tests scoped to the seeded tenant.
- Audit script: new BYPASS status; a `where` from a variable or helper → REVIEW.
- Tests: stricter tenant-filter assertions (loyalty, cash-drawer, order-amendment, tax-document-issuance, outbox), plus 2 new webhook scoping tests.
- Phase 3 (enforce default) prepared but not applied. See STATUS "Phase 3 apply".

## 2026-09-25 — Handoff to local

- STATUS: handoff state + ordered laptop checklist. IMPLEMENTATION_PLAN: progress column, new Step 4 (rollout), smoke-run deviation noted. README status line. RESUME rewritten for the local pick-up (PowerShell commands).
