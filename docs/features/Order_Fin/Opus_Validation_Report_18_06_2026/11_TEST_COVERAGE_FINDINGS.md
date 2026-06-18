# 11 — Test Coverage Findings

## Test architecture (discovered)

- Jest + ts-jest, `testEnvironment: jsdom`. Service tests **mock the Prisma `tx`** client (plain objects with `jest.fn()`); no live DB. `next/jest` stubs `server-only`.
- `test:prisma` → `jest __tests__/db`, but those (`tenant-context`, `prisma-middleware`, `prisma-error-scenarios`) test the client wrapper, **not** real data/constraints.
- **Implication (F-T5):** DB CHECK/FK/RLS enforcement is **never exercised in CI**. This is the structural reason the wallet CHECK blocker (F-00) shipped — and why a "mirror" unit test couldn't catch it.

## Useful, meaningful tests (keep)

- `overpayment-resolution-validator.service.test.ts` — real planner + validator, asserts business outcomes (excess blocks submit, cash auto-resolve, advance accepted).
- `order-financial-classify-refunds.test.ts` — thorough refund-source routing (canonical + legacy heuristic + skip non-PROCESSED).
- `order-financial-warning-codes.test.ts` — `buildWarningCodes` matrix.
- `order-payment-wiring.handler.test.ts` — payment-status propagation.
- `order-settlement-planner.service.test.ts`, `settlement.service.test.ts`, `collection-overpayment.test.ts`, `customer-receipt-allocation*.test.ts`, `stored-value.service.test.ts`.
- `settlement-catalog.test.ts` — **rewritten this session** to assert TS↔catalog parity + migration-DDL (drop CHECK / add FK / RESTRICT / no re-introduced hardcoded CHECK). Previously a false-positive.
- `overpayment-disposition.wallet.test.ts` — **added this session**: wallet credit, audit row, idempotent replay, no-customer reject, `recalc overpaid→0` (and `→20` without disposition).

## False-positive / shallow tests

- **F-T1 (✅ fixed):** old `settlement-catalog.test.ts` "mirrors … CHECK constraint" asserted only `new Set(codes).size === codes.length` (array uniqueness) — green while the real DB CHECK diverged. Replaced.
- **Watch pattern:** any test that lists catalog/enum values inline and asserts only shape/uniqueness rather than comparing to the migration/DB. Audit other `*-catalog`/constants tests for the same anti-pattern.

## Missing tests (priority order)

| ID | Test | Why | Sev |
|----|------|-----|-----|
| T-1 | DB-level integration harness (real test DB + migrations) for the finance suite | Without it, CHECK/FK/RLS regressions ship silently (F-T5/F-00 root cause) | 🟡 High value |
| T-2 | `b2b-statement-payment` idempotency: same key twice → single application | F-02; currently no guard | 🟠 |
| T-3 | AR `allocateArPaymentTx` **regression-lock**: replay returns the cached response (AR is **already** idempotent via `org_idempotency_keys` — this locks it, it is not a fix) | F-02 (lock) | 🔵 |
| F-10 | collect-payment: two sequential partial collections both succeed + sum; explicit-key replay dedupes | F-10 | 🟠 |
| T-4 | `invoice-payment-wiring.handler` unit: INVOICE→`org_invoice_payments_dtl`, no order row | F-T2 / rule 7 | 🔵 |
| T-5 | `statement-payment-wiring.handler` unit: B2B_STATEMENT balance reduced | F-T2 / rule 8 | 🔵 |
| T-6 | RLS test: `org_tax_doc_seq_counters` cross-tenant select returns 0 under tenant ctx | F-01 | 🟠 |
| T-7 | Cash CASH_OUT change idempotency: replay leaves one change row | F-07 | 🔵 |
| T-8 | Recalc: PENDING/AUTHORIZED gateway leg excluded from paid + warning fires | rule 19/20 regression lock | 🔵 |
| T-9 | Allocation: order with open AR invoice → allocates to invoice not order | rule 12 regression lock | 🔵 |
| T-10 | Fallback matrix: auto-allocate exhausts targets → advance/wallet/credit/RETURN_CHANGE/BLOCK | rule 16 | 🔵 |
| T-11 | Multi-category tax decomposition (once F-05 implemented) | tax compliance | deferred |

## Coverage posture

Unit coverage of pure financial logic is **good and meaningful**. The structural gap is **DB-truth tests** and **B2B allocation idempotency** (AR is already idempotent via `org_idempotency_keys`) — the seams where the only critical blocker hid. Prioritize T-1, T-2, T-6, and the F-10 collect-payment test.
