# 19 — Exact Tests to Add or Rewrite

Companion to [11](./11_TEST_COVERAGE_FINDINGS.md). Priority: 🟠 GA · 🔵 hardening.

## Rewritten this session
- ✅ `__tests__/constants/settlement-catalog.test.ts` — was a false-positive (array-uniqueness only); now asserts TS↔catalog parity + migration DDL (drop CHECK / add FK / RESTRICT / no re-introduced hardcoded CHECK).
- ✅ `__tests__/services/overpayment-disposition.wallet.test.ts` *(new)* — wallet credit, audit row, idempotent replay, no-customer reject, recalc `overpaid→0`.

## To add (GA)
| Test file (new) | Scenario | Finding |
|---|---|---|
| `__tests__/db-integration/finance-smoke.test.ts` | Real test DB: insert `SAVE_TO_CUSTOMER_WALLET` disposition vs the live FK; RLS cross-tenant probe; CHECK/FK enforcement | F-T5 (highest leverage) |
| `__tests__/services/b2b-statement-payment.idempotency.test.ts` | Same key twice → single statement application | F-02 |
| `__tests__/tenant-isolation/tax-doc-seq-counters-rls.test.ts` | Cross-tenant select returns 0 under tenant context | F-01 |
| `__tests__/services/collect-payment.idempotency.test.ts` | Two sequential partial collections (same cashier) both succeed + sum; explicit-key replay dedupes | F-10 |

## To add (hardening)
| Test file (new) | Scenario | Finding |
|---|---|---|
| `__tests__/services/invoice-payment-wiring.handler.test.ts` | INVOICE→`org_invoice_payments_dtl`, no order row | F-T2 / rule 7 |
| `__tests__/services/statement-payment-wiring.handler.test.ts` | B2B_STATEMENT balance reduced | F-T2 / rule 8 |
| `__tests__/services/ar-allocate.idempotency.test.ts` | Replay AR allocate key → cached response, single effect (lock the AR mechanism so it can't silently regress) | F-02 (AR confirmed; lock it) |
| `__tests__/services/cash-drawer-change.idempotency.test.ts` | Replay leaves one CASH_OUT row | F-07 |
| `__tests__/services/order-financial-write.gateway-pending.test.ts` | PENDING/AUTHORIZED leg excluded from paid + warning fires | rule 19/20 |
| extend `customer-receipt-allocation.service.test.ts` | Order with open AR invoice → allocate to invoice not order | rule 12 |
| `__tests__/services/customer-receipt-allocation.fallback.test.ts` | Auto-allocate exhausts targets → advance/wallet/credit/RETURN_CHANGE/BLOCK | rule 16 |

## To add (deferred / scope-dependent)
- Refund-create idempotency + reverse-allocation accounting (once verified).
- `voucher-reversal.service` unwind correctness (order-payment + cash + stored-value).
- Tax decomposition (F-05) once implemented.
- Promotion/loyalty engine correctness + stacking.

## Anti-pattern audit (do across the suite)
Find other `*constants*`/`*catalog*` tests that assert only shape/uniqueness rather than DB/migration parity — the F-T1 class. Convert to real parity checks.
