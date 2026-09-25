# Tenant Guard — Violations Worklist (Phase 1 output → Phase 2 closed)

**Captured:** 2026-09-25 · **Mode:** `log` · **Phase 2 closed:** 2026-09-25.

Sources:
- **Runtime:** the full DB-integration suite (`--runInBand`, `TENANT_GUARD_REPORT_FILE`). It sees only exercised paths, but those hits are certain.
- **Static:** `npm run audit:tenant-guard` → [generated/STATIC_AUDIT.md](generated/STATIC_AUDIT.md). Before: model MISSING **113**, REVIEW 90 · raw MISSING 8, REVIEW 7. **After:** model MISSING **0**, REVIEW 95 (verified), BYPASS 2 · raw MISSING 7 / REVIEW 7 (all verified or fixed, §D).
- **Manual smoke:** replaced (STATUS D11): complete static coverage plus a production `log` watch window before `enforce`.

## A. Runtime-confirmed, app code

| # | Callsite | Fix | Status |
|---|---|---|---|
| R1 | `cash-drawer.service.ts` close-session `update` | `tenant_org_id` in where | ✅ 85f841a4 |
| R2 | `stored-value.service.ts` advance `update` | `tenant_org_id` in where | ✅ 85f841a4 |
| R3 | `order-lock.service.ts` (all 9 calls) | 1 line in 85f841a4; remaining 7 per-order calls scoped; expiry sweep → registered bypass | ✅ Phase 2 |
| R4 | `order-refund.service.ts` approve `update` | `tenant_org_id` in where | ✅ 85f841a4 |
| R5 | `order-refund.service.ts` process `update` | `tenant_org_id` in where (+2 more `processRefund` updates in Phase 2) | ✅ |

## B. Runtime-confirmed, test fixtures

All fixture reads/cleanup now scoped to the seeded `tenantId` (no bypass needed):
`cash-drawer-decimal-precision` (6), `cash-drawer-mutation-locking` (6), `cash-drawer-session-numbering-concurrency` (2). ✅ Pending a local DB-suite run to confirm (no Postgres in the cloud container).

## C. Static MISSING (all ✅ Phase 2)

Pattern everywhere: add `tenant_org_id: <tenant in scope>` to the literal `where`. Where the function did not receive the tenant, it was threaded through, never read from ALS.

| File(s) | Notes |
|---|---|
| `gift-card-service.ts` (13) | incl. fire-and-forget PIN migration / counter updates |
| `stored-value.service.ts` (6), `loyalty.service.ts` (6), `discount-service.ts` (6), `voucher-funding-unwind.service.ts` (4) | wallet / advance / credit-note / loyalty lot / promo usage |
| `invoice-service.ts` | `getInvoicesForOrder`; `updateInvoiceWithFinancialSnapshot` now takes `tenantId` (no callers today). The 2 compound-key helper hits were false positives |
| `tax-document-write.service.ts` | `issueTaxDocumentTx` + `supersedeTaxDocument` now filter in the query (previously fetched by id, then compared tenant in JS) |
| `outbox.service.ts` (4) | `markProcessed/markFailed/scheduleRetry` take the event row's `tenantId` (STATUS D8); callers + docs updated |
| `gateway-webhook.service.ts` (7) | STATUS D9. Also: no cross-tenant leg probe when the event has no provider ids |
| `order-lock.service.ts` (8) | STATUS D10 |
| Other services (1–2 each) | ar-dunning-ops, ar-invoice, cash-drawer (variance approval), customer-receipt-excess-executor, order-amendment, order-charge, order-refund, payment-card-brand, payment-transition, reconciliation(+order-snapshot-checks), tax-document-issuance |
| Server actions | tax, payment-methods, terminals, cash-drawers, branch-payment-methods, promo, discount-rule, screen-contracts, loyalty |
| API routes | `preparation/[id]/items/[itemId]`, `loyalty/config`, `finance/reports/payments-breakdown` |

REVIEW triage turned up 2 more real misses, both fixed: `cash-control-settings.service.ts` settings `update`, and the `branch-payment-methods-actions.ts` upsert `update`.

## D. Raw SQL verdicts

| Callsite | Verdict |
|---|---|
| `erp-lite-posting-engine.service.ts` `updatePostingLog` | **Fixed**: `AND tenant_org_id = …` (tenant from the envelope), signature threaded |
| `ar-dunning-ops.service.ts:146`, `ar-statement-cycle.service.ts:176`, `reports/finance-reconciliation-report.service.ts:310` | OK: composed `whereClause` / `conds` always starts with `tenant_org_id = …` |
| `pos-session.service.ts`, `tax-document-issuance.service.ts`, `workflow-policy-preflight.service.ts`, `workflow-profile-resolution.service.ts` | OK: `org_tenants_mst WHERE id = <tenant>` (tenant root) |
| `erp-lite-phase10.service.ts:846` | OK: `WHERE tenant_org_id =` param; table/column names are private literals |
| `order-preference-cf-resolve.ts:71`, `app/api/v1/pricing/history/route.ts:123` | OK: `$1` is the tenant; joins also match on tenant |
| `utils/order-number-generator.ts:44,76` | OK: `generate_order_number($1::uuid)` with tenant |
| `voucher-number.service.ts:42` | OK: advisory lock key only; the following query filters tenant |
| `public-order-tracking.service.ts:150` | OK by design: public token → tenant resolution (token lookup is the only unscoped read; later reads filter tenant) |

## E. Tooling

- `audit-tenant-guard.mjs` now reports **BYPASS** (call directly inside `withTenantGuardBypass`), and treats a `where` built in a variable or helper as REVIEW instead of MISSING.
