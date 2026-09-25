# Tenant Guard — Violations Worklist (Phase 1 output)

**Captured:** 2026-09-25 · **Mode:** `log` · This is the Phase 2 input. Tick items off here as they're fixed.

Sources:
- **Runtime:** the full DB-integration suite (`--runInBand`, `TENANT_GUARD_REPORT_FILE`). It sees only exercised paths, but those hits are certain.
- **Static:** `npm run audit:tenant-guard` → [generated/STATIC_AUDIT.md](generated/STATIC_AUDIT.md). Heuristic, covers everything. Counts: model MISSING **113**, REVIEW **90**, OK 867 · raw SQL MISSING **8**, REVIEW **7**, OK 317.
- **Manual smoke** of the main screens in `npm run dev` (log mode): **Pending**. It is a Phase 1 remainder; append findings here.

## A. Runtime-confirmed, app code (fix first)

| # | Callsite | Call | Proposed fix | Status |
|---|---|---|---|---|
| R1 | `lib/services/cash-drawer.service.ts:1780` | `org_cash_drawer_sessions_mst.update` where `{id}` | add `tenant_org_id` (close-session path) | Open |
| R2 | `lib/services/stored-value.service.ts:280` | `org_customer_advances_mst.update` where `{id}` | add `tenant_org_id` | Open |
| R3 | `lib/services/order-lock.service.ts:187` | `org_order_edit_locks.findUnique` | add `tenant_org_id` (9 static hits in this file) | Open |
| R4 | `lib/services/order-refund.service.ts:678` | `org_order_refunds_dtl.update` | add `tenant_org_id` | Open |
| R5 | `lib/services/order-refund.service.ts:1059` | `org_order_refunds_dtl.update` | add `tenant_org_id` | Open |

## B. Runtime-confirmed, test fixtures (fix or bypass)

Fixture setup/cleanup through the model API without a tenant filter. Fix these by adding the seeded tenant id, or by wrapping cleanup in `withTenantGuardBypass('db-test-cleanup', …)`. Either way they have to be clean before Phase 3 switches `jest.db.config.js` to `enforce`.

- `cash-drawer-decimal-precision.db.test.ts`: lines 84, 110, 113–115, 174
- `cash-drawer-mutation-locking.db.test.ts`: lines 74–76, 111, 154, 157
- `cash-drawer-session-numbering-concurrency.db.test.ts`: lines 76, 79

(Hits from `tenant-guard-cross-tenant.db.test.ts` are intentional and excluded.)

## C. Static MISSING by file (literal where/data without `tenant_org_id`)

Line-level detail is in [generated/STATIC_AUDIT.md](generated/STATIC_AUDIT.md).

| Count | File | Note |
|---|---|---|
| 13 | `lib/services/gift-card-service.ts` | |
| 9 | `lib/services/order-lock.service.ts` | includes R3 |
| 7 | `lib/services/stored-value.service.ts` | includes R2 |
| 7 | `lib/services/gateway-webhook.service.ts` | `sys_gw_webhook_events_tr`: webhooks arrive before tenant is known → **bypass candidate** |
| 7 | `app/actions/settings/tax-actions.ts` | |
| 6 | `lib/services/loyalty.service.ts` | |
| 6 | `lib/services/discount-service.ts` | |
| 5 | `app/actions/payment-config/payment-methods-actions.ts` | |
| 4 | `lib/services/voucher-funding-unwind.service.ts` | |
| 4 | `lib/services/outbox.service.ts` | cross-tenant sweep? → **bypass candidate** |
| 4 | `lib/services/order-refund.service.ts` | includes R4/R5 |
| 4 | `lib/services/invoice-service.ts` | |
| 4 | `app/actions/payment-config/terminals-actions.ts` | |
| 3 | `lib/services/tax-document-write.service.ts` | |
| 3 | `app/actions/payment-config/cash-drawers-actions.ts` | |
| 3 | `app/actions/marketing/promo-actions.ts` | |
| 2 | `payment-card-brand.service.ts`, `order-charge.service.ts`, `cash-drawer.service.ts` (incl. R1), `app/api/v1/preparation/[id]/items/[itemId]/route.ts`, `screen-contracts-actions.ts`, `discount-rule-actions.ts` | each |
| 1 | `tax-document-issuance.service.ts`, `reconciliation/order-snapshot-checks.ts`, `reconciliation.service.ts`, `payment-transition.service.ts`, `order-amendment.service.ts`, `customer-receipt-excess-executor.service.ts`, `ar-invoice.service.ts`, `ar-dunning-ops.service.ts`, `app/api/v1/loyalty/config/route.ts`, `app/api/v1/finance/reports/payments-breakdown/route.ts`, `branch-payment-methods-actions.ts`, `loyalty-actions.ts` | each |

The 90 REVIEW entries (args built in a variable, `{ where }` shorthand or a spread) need reading. The runtime guard settles them once each path is exercised.

## D. Raw SQL (guard cannot check; manual review)

**MISSING** (template references `org_*` with no `tenant_org_id`): `ar-dunning-ops.service.ts:146`, `ar-statement-cycle.service.ts:176`, `erp-lite-posting-engine.service.ts:1264`, `pos-session.service.ts:279`, `reports/finance-reconciliation-report.service.ts:310`, `tax-document-issuance.service.ts:72`, `workflow/workflow-policy-preflight.service.ts:79`, `workflow/workflow-profile-resolution.service.ts:372`.

**REVIEW** (`Unsafe` / non-template): `erp-lite-phase10.service.ts:846`, `order-preference-cf-resolve.ts:71`, `public-order-tracking.service.ts:150`, `voucher-number.service.ts:42`, `utils/order-number-generator.ts:44,76`, `app/api/v1/pricing/history/route.ts:123`.

Some of these may be scoped through a join or a tenant-bound id. Each one needs a verdict before Phase 3.
