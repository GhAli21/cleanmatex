# 08 — Backend & API Findings

## Backend services — verified strong

| Service | Verdict | Evidence |
|---|---|---|
| `order-financial-write.service` (recalc) | ✅ Production-grade | Single canonical recalc; correct paid/credit/pending/overpaid math (689-774); engine v5 snapshot + hash + trace id |
| `order-submit-orchestrator.service` | ✅ | One `prisma.$transaction` wraps order→invoice→voucher→legs→stored-value→disposition→allocation→settle (719-974); per-sub-op idempotency keys |
| `overpayment-resolution-validator.service` | ✅ | Catalog-driven; blocks unresolved excess; cash-only RETURN_CHANGE capacity; allocation preview validation (68-160) |
| `overpayment-disposition.service` | ✅ | Wallet/advance/credit via stored-value tx; per-line idempotency lookup; audit row (now FK-safe) |
| `order-payment-wiring.handler` | ✅ | Hard-asserts `target_type='ORDER' AND target_id=order_id` (46-50); `nature='REAL_PAYMENT'`; PENDING for gateway/bank/check |
| `invoice-payment-wiring.handler` | ✅ | Routes to `org_invoice_payments_dtl`, never order rows; AR allocate **idempotent via `org_idempotency_keys`** (corrected) |
| `statement-payment-wiring.handler` | ✅ logic / 🟡 idempotency | Routes to B2B statement — the **one** non-idempotent allocation path (F-02/F-04) |
| `cash-drawer-wiring.handler` | ✅ / 🔵 | CASH_SALE uses settled `line.amount`; CASH_OUT change; F-07 on change idempotency |
| `customer-open-balance-query.service` | ✅ | AR-invoice-wins (161); currency/branch/policy filters; B2B via raw SQL |
| `b2b-statement-payment.service` | 🟡 | `FOR UPDATE` + status/cap correct, but **ignores its `idempotencyKey`** (uses neither effect-index nor `org_idempotency_keys`), no detail row — **sole non-idempotent allocation path** (F-02/F-04) |
| `stored-value.service` | ✅ | wallet/advance/credit-note issue+redeem; **zero** references to `org_order_payments_dtl` (rules 5/6) |
| `tax-document-sequence.service` | ✅ logic / 🟠 RLS | `FOR UPDATE` gap-free numbering, tenant-filtered; underlying table lacks RLS (F-01) |
| `ar-invoice.service` (allocate verified) | ✅ | Allocate **idempotent** via `withIdempotency`+`org_idempotency_keys` (290-343, 556-568); outbox, AR ledger, adjustments, status machine. Reverse-allocation accounting still ❓ |

## Transaction boundaries & idempotency

- **Submit is atomic.** Despite a misleading `// tx1 — create order` comment (orchestrator:564), all writes occur inside one `$transaction` (719). A failure anywhere — including a disposition/wiring error — rolls the whole order back. ✅
- **Route-level idempotency is excellent** (`submit-order/route.ts`): stake-before-orchestrator claim, payload-hash conflict (`409 IDEMPOTENCY_CONFLICT`), orphan-heal, `PRIOR_ATTEMPT_FAILED`, unstake-on-rollback. This was hardened after a real orphan-voucher incident (documented inline). ✅
- **Sub-operation idempotency keys** are deterministic and order-scoped (`${orderId}_vch`, `_vl_rp_${i}`, `_sv_..._${i}`, `_op_${code}_${i}`). ✅
- **Gap (F-02, B2B-only — corrected):** AR allocation **is** idempotent via the central `org_idempotency_keys` cache (`withIdempotency`). Only the **B2B statement** allocation effect has no idempotency guard.
- **Gap (F-10):** `collectPaymentTx` defaults its idempotency key to `${orderId}_collect_${collectedBy}` (order-settlement.service.ts:604) — not unique per collection event; the `collect-payment` route makes the key optional. See [05 §F-10](./05_GAPS_AND_BUGS.md#f-10--collectpaymenttx-default-idempotency-key-is-not-event-unique--medium-verify).

## Error handling

- `submit-order` maps domain errors to precise HTTP codes incl. all `OVERPAYMENT_RESOLUTION_*` and `RECEIPT_ALLOCATION_EXCESS_UNRESOLVED` → 422 (417-428). ✅
- B2B statement / allocation throw typed warning codes (`RECEIPT_ALLOCATION_WARNING_CODES.TARGET_PAID`). ✅
- Idempotency-store failures are non-fatal with logging; claim failure aborts (correct). ✅

## API routes

| Route | Permission | Feature flag | Validation | Idempotency | Notes |
|---|---|---|---|---|---|
| `POST /orders/submit-order` | ✅ `orders:create` | 🔴 none | ✅ Zod | ✅ full lifecycle | CSRF guard; production-grade |
| `POST /orders/[id]/collect-payment` | ✅ `orders:collect_payment` | 🔴 none | ✅ Zod (key optional) | 🟡 F-10 (default key not event-unique) | CSRF ✅; reuses disposition/allocation; errors all → 422 (coarse) |
| `POST /customer-receipts/allocation/post` | ✅ `orders:overpayment_allocate` OR `customers:receipt_allocate` | 🔴 none | ✅ Zod | ✅ via preview confirm | F-03 |
| `POST /customer-receipts/allocation/preview-auto|manual` | ❓ verify | 🔴 none | ✅ (schemas exist) | ✅ preview idempotency idx | not read this pass |
| `GET /customers/[id]/open-balances` | ❓ verify | n/a | — | n/a | `listCustomerOpenBalancesForApi` |
| `POST /ar/invoices/[id]/allocations` (+ reverse) | ❓ verify | 🔴 none | ❓ | ✅ via `org_idempotency_keys` | reverse-allocation accounting ❓ |

**F-03 (feature flags):** No order/payment/receipt route checks `overpayment_disposition_v1` / `customer_receipt_allocation_v1`. The flags exist only as DB seeds (0376/0377). Decide: wire them (kill-switch) or retire + update ADR-047.

## Service-level observations (not bugs, note for maintenance)

- `listCustomerOpenBalancesForApi` defaults `currencyCode` to `'OMR'` (customer-open-balance-query.service.ts:263) when not supplied — a hardcoded currency fallback. Low risk (callers pass currency), but violates the "no default currency" rule if ever reached. → track as minor.
- `order-submit-orchestrator.service.ts:564` stale "tx1" comment — fix to avoid future "two-transaction" misreads.
- Risk markers across finance services are minimal (5 total; none in the core payment/settlement path) — codebase is clean.
