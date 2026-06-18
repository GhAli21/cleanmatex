# 09 — API Findings

(Companion to [08](./08_BACKEND_API_FINDINGS.md), which covers backend services. This file isolates the route layer.)

## Routes implemented (finance, `app/api/v1`)
`orders/submit-order`, `orders/[id]/collect-payment`, `orders/[id]/payments`, `orders/[id]/payments/[paymentId]/verify`, `orders/[id]/financial-summary`, `orders/[id]/report/payments-rprt`, `customer-receipts/allocation/{preview-auto,preview-manual,post}`, `customer-receipts/post`, `customers/[id]/open-balances`, `ar/invoices/[id]/allocations` (+ `/reverse`), `finance/reports/payments-breakdown`, `settings/payments/{methods,card-brands,terminals}`.

## Per-route assessment

| Route | CSRF | Permission | Feature flag | Validation | Idempotency | Notes |
|---|---|---|---|---|---|---|
| `POST submit-order` | ✅ | ✅ `orders:create` | 🔴 | ✅ Zod (key required) | ✅ full lifecycle | production-grade |
| `POST [id]/collect-payment` | ✅ | ✅ `orders:collect_payment` | 🔴 | ✅ Zod (key **optional**) | 🟡 F-10 (default key not event-unique) | errors all → 422 (coarse) |
| `POST customer-receipts/allocation/post` | ❓ | ✅ `orders:overpayment_allocate` OR `customers:receipt_allocate` | 🔴 | ✅ Zod | ✅ preview-confirm | F-03 |
| `POST customer-receipts/allocation/preview-auto\|manual` | ❓ | ❓ verify | 🔴 | ✅ schemas exist | ✅ preview idx | not read |
| `GET customers/[id]/open-balances` | n/a | ❓ verify | n/a | — | n/a | `listCustomerOpenBalancesForApi` (defaults currency 'OMR') |
| `POST ar/invoices/[id]/allocations` (+reverse) | ❓ | ❓ verify | 🔴 | ❓ | ✅ via `org_idempotency_keys` | reverse accounting not verified |

## Findings

- **API-01 (🟡 = F-03):** No finance route checks `overpayment_disposition_v1` / `customer_receipt_allocation_v1`. Flags are dead seed data.
- **API-02 (🟡 = F-10):** `collect-payment` accepts an **optional** idempotency key and defaults to a non-event-unique value server-side. Should require a per-event key like submit-order.
- **API-03 (🔵):** `collect-payment` maps **all** errors to HTTP 422 with the raw message (`route.ts:47-49`); submit-order has precise per-code mapping. Inconsistent error contract; cosmetic but affects client UX/observability.
- **API-04 (❓):** CSRF + permission on `preview-auto/manual`, `open-balances`, and `ar/invoices/.../allocations` **not verified** — confirm every mutating finance route has CSRF + permission (submit + collect + allocation-post do).
- **API-05 (🔵):** `open-balances` default currency `'OMR'` (`customer-open-balance-query.service.ts:263`) — violates the "no default currency" rule if ever reached; callers pass currency, so low risk.

## Response shape / payload
- Submit returns `{ success, data: { order, fromCache? } }`; collect returns `{ success, data: SettlementResult }`; allocation-post returns `{ success, data: { previewId, previewStatus, allocations, remainingUnallocatedAmount } }`. Consistent envelope. No payload mismatch found in the routes read.
- **Not verified:** UI→API payload alignment for the allocation drawers and collect modal (component bodies not opened).
