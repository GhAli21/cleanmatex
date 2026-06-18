# 03 — Implementation Status Dashboard

Legend: ✅ Implemented · 🟡 Partial · 🔴 Missing/broken · ⚪ N/A·deferred · ❓ Not verified

| Area | Status | Evidence | Risk | Notes |
|------|--------|----------|------|-------|
| Database schema (finance) | ✅ | 78 finance tables; RLS on 77/78 | Low | One RLS gap (F-01) |
| Migrations ordering | ✅ | `0300`–`0378` sequential; 0378 applied+verified | Low | 0360 Part A is a gated/skipped rename branch (benign) |
| Settlement catalogs (`sys_fin_*`) | ✅ | `0357`; `sys_fin_overpay_res_cd` 9 rows | Low | Extends `sys_fin_vch_*`, no dup tables |
| Catalog↔audit binding | ✅ | `org_fin_overpay_disp_res_fk` (0378) | Low | FK replaced drift-prone CHECK |
| Order financial snapshot | ✅ | `recalculateOrderFinancialSnapshotTx` | Low | Engine v5; canonical fields |
| Order submit | ✅ | `submit-order/route.ts` + orchestrator | Low | Single TX, robust idempotency |
| Order recalculation | ✅ | one recalc path reused everywhere | Low | — |
| Discounts / charges / pieces / preferences | ✅ | recalc aggregates rec_status/is_voided | Low | reduce order value correctly |
| Taxes (flat VAT) | ✅ | `org_order_taxes_dtl` sum; inclusive/exclusive modes | Med | base decomposition stubbed → F-05 |
| Tax-base decomposition (exempt/zero/out-of-scope) | 🔴 | hardcoded 0 (write svc 685-688) | Med-High | F-05; GCC e-invoicing gap |
| Payment modal (V4) | ✅ | `payment-modal-v4.tsx` + extra-receipt card | Low | labels correct |
| Payment methods config | ✅ | `org_payment_methods_cf`, ADR-046 flags | Low | — |
| Payment legs / real payments | ✅ | planner + order-payment wiring | Low | nature_snapshot=REAL_PAYMENT |
| Cash / card / mobile (immediate) | ✅ | `resolvePaymentStatus` → COMPLETED | Low | — |
| Bank transfer / check / gateway (deferred) | ✅ | → PENDING; excluded from paid | Low | rule 19 honored |
| Pending / authorized / failed lifecycle | ✅ | separate buckets + warnings | Low | — |
| Credit applications (gift/wallet/advance/credit) | ✅ | `ORDER_CREDIT_APPLICATION` legs | Low | only APPLIED counts |
| Gift card | ✅ | credit application, not discount | Low | `0331` semantics fix |
| Wallet | ✅ | `topUpWalletTx`/`redeemWalletTx`; no order-pay rows | Low | — |
| Customer advance | ✅ | `issueAdvanceTx`/`redeemAdvanceTx` | Low | — |
| Customer credit / credit note | ✅ | `issueCreditNoteTx`/`redeemCreditNoteTx` | Low | — |
| BVM voucher header/lines | ✅ | `org_fin_vouchers_mst` + `_trx_lines_dtl` | Low | CHECKs + idempotency idx |
| Voucher posting + wiring | ✅ | `postAndWireBizVoucher`, handler registry | Low | back-links populated |
| Cash drawer sessions/movements | ✅ | `cash-drawer-wiring.handler` | Low | CASH_OUT change idempotency → F-07 |
| Overpayment / extra receipt | ✅ | validator + disposition svc | Low | wallet path fixed (0378) |
| Overpayment disposition (change/reduce/wallet/advance/credit) | ✅ | `executeOverpaymentDispositionTx` | Low | VOID/RESTORE intentionally deferred |
| Customer receipt allocation (manual) | ✅ | preview/validator/posting svcs + drawer | Low | — |
| Auto allocation (oldest) | ✅ | policy seed + open-balance ordering | Low | — |
| Customer open-balance lookup | ✅ | `customer-open-balance-query.service` | Low | AR-invoice-wins enforced |
| AR invoice | ✅ | `ar-invoice.service` (ledger, outbox) | Low | **idempotent via `org_idempotency_keys`** (corrected — see 22) |
| Invoice payment wiring | ✅ | `invoice-payment-wiring.handler` | Low | AR allocate idempotency confirmed present |
| B2B statement | 🟡 | `b2b-statement-payment.service` | Med | **no idempotency, no detail table → F-02 (Med) / F-04** |
| Pay on collection | ✅ | `payOnCollectionAmount` ≠ AR | Low | rule 26 |
| Refund / reversal / void | ❓ | `order-refund.service`, `voucher-reversal.service` exist | Med | not deeply verified |
| Tax documents | 🟡 | `org_tax_documents_mst` (0341), seq service | Med | RLS gap on seq counters (F-01); fiscal-total not read (F-05) |
| APIs | ✅ | versioned routes, schema validation, permissions | Med | no feature-flag gating (F-03) |
| Backend services | ✅ | thin routes + service layer | Low | minor idempotency asymmetry |
| Frontend UI | ✅ | Cmx components; canonical labels | Low | no flag-driven UI gating (F-03) |
| Tests | 🟡 | broad unit suite; mocked Prisma | Med | no DB-level tests (F-T5); missing wiring/idempotency tests |
| Permissions | ✅ | seeded + enforced via `requirePermission` | Low | `resource:action` format ok |
| Feature flags | 🔴 | seeded (0376/0377) but unwired | Med | F-03 |
| RLS | 🟡 | 77/78 finance tables | High | F-01 (`org_tax_doc_seq_counters`) |
| i18n | ❓ | keys present; AR parity not run | Low | run `npm run check:i18n` |
| Docs / ADRs | 🟡 | mostly aligned; ADR-047 "Proposed" | Low | F-06; code ahead of docs in places |

## Business rules discovered from code (cross-ref [05](./05_GAPS_AND_BUGS.md) / brief's 26 rules)

| Rule (brief #) | Where enforced | Documented | Correct? |
|---|---|---|---|
| Payment rows ORDER-only (1,2) | `0337` drop; order-pay wiring 46-50 | ✅ | ✅ |
| Generic targeting on voucher line (3) | `0301`/`0357` CHECKs | ✅ | ✅ |
| Stored value ≠ real payment (4,5,6,23) | stored-value svc; recalc nature filter | ✅ | ✅ |
| Invoice→INVOICE_PAYMENT/INVOICE (7) | invoice wiring handler | ✅ | ✅ |
| Statement→STATEMENT_PAYMENT/B2B_STATEMENT (8) | statement wiring handler | ✅ | ✅ |
| Wallet/advance/credit roles (9,10,11) | `voucher.ts` LINE_ROLE | ✅ | ✅ |
| AR-invoice-wins-over-order (12) | open-balance query 161 | 🟡 | ✅ |
| overpaid = unresolved only (13,14) | write svc 767-774 | ✅ | ✅ |
| Excess explicitly resolved (15,16) | validator + fallback seed | ✅ | ✅ |
| RETURN_CHANGE cash-only (17) | validator 132-159 | ✅ | ✅ |
| Card/gateway excess explicit (18) | REDUCE_PAYMENT; VOID deferred | 🟡 | ✅ (partial) |
| Pending/authorized not collected (19) | write svc 722-723 | ✅ | ✅ |
| Only completed/captured/settled paid (20) | lifecycle const 446 | ✅ | ✅ |
| Only APPLIED credits (21) | write svc 689-692 | ✅ | ✅ |
| Discounts reduce value (22) | `resolveCanonicalTotalAmount` | ✅ | ✅ |
| Tax docs ≠ AR invoice (24,25) | `0341`; AR receivable-only | ✅ | ✅ |
| PAY_ON_COLLECTION ≠ AR (26) | write svc split | ✅ | ✅ |
| **Allocation has audit trail (19, brief readiness)** | voucher line yes; B2B no detail table | 🟡 | 🟡 → F-02/F-04 |
