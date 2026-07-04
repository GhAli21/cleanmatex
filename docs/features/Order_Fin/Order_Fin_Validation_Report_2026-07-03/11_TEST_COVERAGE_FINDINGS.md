# 11 — Test Coverage Findings

## Current state (from checked-in status logs + file inventory; not re-executed this pass)

- **164 test files** under `web-admin/__tests__/` (counted this pass).
- Last recorded full gates (Payment Modal v4 program close, 2026-07-03, committed `ab51b70d`): **jest 1586 pass** (incl. payload oracle 8/8) · `tsc --noEmit` 0 · eslint 0 · `npm run build` green · `check:i18n` green.
- **DB-integration harness** (`jest.db.config.js`, node env, real local Supabase, rolled-back txs): 17 tests / 4 suites — finance smoke (CHECK/FK/RLS truths incl. the F-00 regression lock and cross-tenant invisibility), reconciliation SQL validity + isolation, collect-payment idempotency, AR-allocate idempotency + linkage lock.

## Where coverage is genuinely strong

| Layer | Evidence |
|---|---|
| Money math (pure) | money-derivations, validation, warning-codes (`order-financial-write.gateway-pending.test.ts` — pending/authorized never counted as paid), needs-advanced, quick-tender, shortcut matrix |
| Contract freeze | `payment-payload-oracle.test.ts` — 8 deep-equality fixtures pin the submit payload |
| Idempotency | DB-level: collect-payment (F-10 class), AR allocate (+ allocationPaymentId linkage lock), B2B statement replay; unit: cash-drawer change (CASH_IN line-anchor), refund replay (+5 tests) |
| Wiring handlers | invoice-payment + statement-payment handler suites (14 combined) incl. the raw-SQL `getLinkedEffect` regression lock |
| Voucher lifecycle | validation transition table ("blocks REVERSED → POSTED"), reversal reviewed |
| Allocation | customer-receipt allocation edge cases + fallback-destination matrix (5) |
| Catalog/DDL parity | settlement-catalog test converted to migration-DDL parity (anti-pattern F-T1 class audited and closed in D-12 §5) |

This is a materially better safety net than at the 2026-06-18 pass — the two structural seams called out then (no DB-truth tests; shape-only catalog tests) are both closed.

## Gaps (ordered by risk)

1. **Nothing locks the FN-01 seam.** No test asserts "a canonically-collected payment appears in `getPaymentsReport` / order payments print data" — precisely the drift that happened. When repointing readers (13 §1), add a DB-integration test: settle order → canonical payment row → payments-report query returns it.
2. **No cancellation-flow financial test.** Nothing asserts post-cancel invariants (payments disposed, credits reversed, snapshot recalced) — currently they'd fail, which is FN-02; the fix must land with tests.
3. **Gateway lifecycle (R-02):** PENDING→CAPTURED capture/callback path has warning-code units only; no integration exercise of a gateway leg reaching COMPLETED.
4. **Multi-currency (R-07):** no test found with `currency_ex_rate ≠ 1` through recalc → base-currency projections unverified.
5. **Print/report data routes untested:** the two order print routes (`payments-rprt`, `invoices-payments-rprt`) have no route tests (auth, tenant scope, shape) — they also happen to be the ungated ones (FN-04).
6. **E2E remains manual** (QA guides + 2D manual matrix). Acceptable per program strategy; the pending v4 manual passes (escalation #9, tablet) should be executed before release (R-05).

## Recommendation

Pair every FN fix with its locking test (the project's own pattern — e.g. 0378's regression lock). Priority additions: (1) canonical-payment-visible-in-reports DB test, (2) cancel-unwind invariants test, (3) a `currency_ex_rate=0.26` recalc fixture. Skip broad E2E investment until the ledger unification lands — it would pin today's wrong behavior.
