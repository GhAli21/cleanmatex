# Legacy Finance Status Matrix

This matrix tracks whether a finance-related file is canonical, a compatibility adapter, frozen legacy, or ready for deletion.

| Path | Status | Canonical replacement | Notes |
|---|---|---|---|
| `web-admin/lib/services/ar-invoice.service.ts` | canonical | N/A | Canonical AR invoice lifecycle, ledger, reports, and statements |
| `web-admin/lib/services/voucher-biz.service.ts` | canonical | N/A | Canonical voucher CRUD/state management |
| `web-admin/lib/services/voucher-wiring.service.ts` | canonical | N/A | Canonical posting and linked-effects orchestration |
| `web-admin/lib/services/order-settlement.service.ts` | canonical | N/A | Canonical order payment and credit application fact writer |
| `web-admin/lib/services/order-financial-summary.service.ts` | canonical | N/A | Canonical order financial read-model |
| `web-admin/lib/services/payment-service.ts` | canonical | N/A | Canonical payment orchestration, with invoice truth delegated to AR artifacts/allocation helpers |
| `web-admin/lib/services/invoice-service.ts` | adapter | `ar-invoice.service.ts` | Keep only for older order-centric consumers and compatibility actions |
| `web-admin/app/actions/payments/invoice-actions.ts` | adapter | `/api/v1/ar/*` + `ar-invoice.service.ts` | Older action entrypoint used by order screens |
| `web-admin/app/actions/payments/invoice-list-actions.ts` | frozen | `/api/v1/ar/invoices` | No current production caller discovered; keep until verified deletable |
| `web-admin/src/features/finance/vouchers/access/vouchers-access.ts` | canonical | N/A | Feature-local voucher access contract owner |
| `web-admin/src/features/payment-config/access/payment-config-access.ts` | canonical | N/A | Feature-local payment setup access contract owner |
| `web-admin/src/features/billing/access/billing-access.ts` | canonical | N/A | Owner for AR, payments, cash-drawer, refund, and reconciliation route contracts |

## Status Meanings

- `canonical` — source of truth for new work
- `adapter` — compatibility layer that may remain temporarily
- `frozen` — no new callers; keep only until deletion proof is complete
- `deletable` — safe to remove after zero-reference validation
