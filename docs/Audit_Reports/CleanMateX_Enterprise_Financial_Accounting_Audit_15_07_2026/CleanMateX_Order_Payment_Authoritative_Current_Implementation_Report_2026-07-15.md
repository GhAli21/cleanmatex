# CleanMateX Order Payment & Financial Accounting
## Authoritative Current-State and Target-Capability Report (Consolidated v2)

**Report date:** 2026-07-15 · **Reference commit:** `5f5b8a8c` · **Runtime root:** `web-admin/`
**Method:** direct runtime-code inspection (routes → services → tables), callers traced; runtime wins over documentation. No code changed.
**Status vocabulary:** `IMPLEMENTED` · `IMPLEMENTED_WITH_CONSTRAINTS` · `PARTIAL` · `DISCONNECTED` · `CONFIGURED_ONLY` · `DOCUMENTED_ONLY` · `LEGACY` · `DUPLICATED` · `UNSAFE_DIRECT_UPDATE` · `NOT_FOUND` · `NOT_APPLICABLE`
**Layer rule (fixed):** BVM = operational voucher/wiring layer. ERP-Lite = double-entry GL. They are never interchangeable.

## Table of Contents

Current state (1–19): [1 Executive Summary](#1-executive-summary) · [2 Runtime Flow](#2-authoritative-runtime-flow) · [3 Canonical Authorities](#3-canonical-authorities) · [4 Commercial Formulas](#4-current-commercial-calculation-formulas) · [5 Snapshot Calculation](#5-canonical-snapshot-calculation) · [6 Payment & Settlement](#6-payment-and-settlement) · [7 Stored Value](#7-credits-and-stored-value) · [8 Refunds & Reversals](#8-refunds-reversals-and-voids) · [9 Cancellation](#9-order-cancellation-and-financial-unwind) · [10 Order Edit](#10-order-edit-and-financial-mutation) · [11 BVM](#11-bvm-operational-voucher-layer) · [12 ERP-Lite](#12-erp-lite-accounting-layer) · [13 Reconciliation](#13-reconciliation) · [14 Tax](#14-tax-tax-inclusive-pricing-and-tax-documents) · [15 Currency/FX](#15-currency-precision-rounding-and-fx) · [16 Transactions & Idempotency](#16-transactions-locking-and-idempotency) · [17 Cash Drawer](#17-cash-drawer-and-pos-session) · [18 Duplicate/Legacy](#18-duplicate-legacy-and-alternative-logic) · [19 Capability Matrix](#19-consolidated-capability-matrix)
Gaps & governance (20–27): [20 Missing Capabilities](#20-missing-or-disconnected-capabilities) · [21 Highest Risks](#21-highest-risk-inconsistencies) · [22 Safe Scope](#22-safe-and-restricted-operational-scope) · [23 Architecture Decisions](#23-required-canonical-architecture-decisions) · [24 Remediation Priority](#24-remediation-priority) · [25 Test Matrix](#25-required-test-matrix) · [26 Evidence Index](#26-evidence-index) · [27 Prior Verdict](#27-final-authoritative-verdict-superseded-by-51)
Deep inventories (28–51): [28 Transaction Catalogue](#28-complete-financial-transaction-catalogue) · [29 Amendments](#29-order-amendment-and-financial-mutation-coverage) · [30 Cancellation Matrix](#30-order-cancellation-matrix) · [31 Payment-Method Lifecycles](#31-payment-method-lifecycle-matrix) · [32 Split/Later Collection](#32-split-partial-later-collection-and-pay-on-collection-matrix) · [33 Stored-Value Lifecycles](#33-stored-value-lifecycle-matrix) · [34 Refund/Void/Goodwill](#34-refund-reversal-void-and-goodwill-matrix) · [35 Customer Receipts](#35-customer-receipt-and-unapplied-cash-lifecycle) · [36 AR Lifecycle](#36-accounts-receivable-lifecycle) · [37 Revenue Recognition](#37-revenue-recognition-and-contract-liability) · [38 BVM Documents](#38-bvm-operational-document-catalogue) · [39 ERP Event Matrix](#39-erp-lite-accounting-event-matrix) · [40 Cash/Bank/Gateway Controls](#40-cash-safe-bank-and-gateway-controls) · [41 Tax Documents/E-Invoice](#41-tax-document-and-e-invoice-lifecycle) · [42 FX & Rounding Lifecycle](#42-currency-fx-precision-and-rounding-lifecycle) · [43 Permissions](#43-financial-permission-and-approval-matrix) · [44 Registry Governance](#44-transaction-status-and-event-registry-governance) · [45 Jobs & Recovery](#45-jobs-schedulers-and-recovery-processes) · [46 Reporting Consistency](#46-reporting-and-receipt-consistency) · [47 Service Gap Matrix](#47-current-vs-required-service-gap-matrix) · [48 Database Gap Matrix](#48-current-vs-required-database-gap-matrix) · [49 Scenario Matrix](#49-end-to-end-scenario-coverage-matrix) · [50 Backlog](#50-consolidated-missingpending-backlog) · [51 Readiness Verdicts](#51-final-readiness-verdict)

---

# 1. Executive Summary

CleanMateX has a mature **initial tax-exclusive checkout core**: `calculateOrderTotals` → `submitOrder` → `buildSettlementPlan` → BVM receipt voucher + wiring → `settleOrderTx(wiringMode:true)` → `recalculateOrderFinancialSnapshotTx`, all in one Prisma transaction with staked idempotency, `FOR UPDATE` stored-value locking, and deterministic lock ordering. Split tender, stored-value settlement, overpayment disposition, pay-on-collection, AR invoice creation, cash-drawer movement, and snapshot recalc are real and connected.

The platform is **not consistent across the full order-to-cash lifecycle**. Confirmed top gaps (details in §21/§50):

1. Refund processing writes neither `refund_source_type` nor `reopens_due_amount` → paid orders stay `PAID` after cash refunds, and refund classification falls back to heuristics.
2. Snapshot and reconciliation compute outstanding with **different formulas** → permanent false blockers after refunds.
3. Later collection (`collectPaymentTx`) bypasses BVM, has weak idempotency, and trips the platform's own voucher-link reconciliation invariant.
4. ERP-Lite payment, refund, gift-card, and wallet-settlement (`ORDER_SETTLED_WALLET`) dispatchers/event codes exist but have **no runtime callers** (DISCONNECTED). Wallet top-up, customer-advance, loyalty-liability, and AR-allocation accounting event codes were **not found** (NOT_FOUND). POS settlements therefore never reach the GL.
5. Gift-card **sale** and wallet **top-up** write their stored-value ledger rows (GC SALE txn, wallet TOP_UP txn), but no tender/payment fact, BVM voucher, cash-drawer movement, or ERP-Lite GL posting is created (§33).
6. The financial **outbox has no consumer** — loyalty earning is a concrete victim: `queueEarnPoints` only emits `LOYALTY_EARN` and nothing processes it (H7); `expireGiftCards` has no scheduler (§45).
7. Tax-inclusive pricing, tax documents/e-invoice, currency rounding, FX gain/loss, order amendments, and gateway callbacks are partial, disconnected, or not found.

Per-domain readiness verdicts are in §51. No coverage percentage is stated (no weighted scoring model defined).

# 2. Authoritative Runtime Flow

```text
UI (payment-full-view / simple view, use-payment-totals)
 ├─ Preview: POST /api/v1/orders/preview-payment | preview-financials → calculateOrderTotals
 └─ Submit:  POST /api/v1/orders/submit-order  (CSRF, orders:create, Zod, staked idempotency hash)
     └─ submitOrder (order-submit-orchestrator.service.ts)
        calculateOrderTotals → AMOUNT_MISMATCH check → buildSettlementPlan → validateSettlementPlan
        → validateOverpaymentResolution → ONE prisma.$transaction (:719–1001):
          order+items → AR invoice (CREDIT_INVOICE & outstanding>0, key `${orderId}_ar`) → promo apply
          → createBizVoucher RECEIPT + addVoucherLine per leg + applyStoredValueDebitTx per credit leg
          → postAndWireBizVoucher (writes org_order_payments_dtl / credit_apps / drawer movements)
          → overpayment disposition/allocation → settleOrderTx(wiringMode) → snapshot recalc
Later collection: /orders/[id]/collect-payment (dup: /orders/[id]/payments) → collectPaymentTx
  → direct payment facts + drawer movements, NO voucher → snapshot recalc
Verification: verifyPaymentTx (FOR UPDATE, PENDING→COMPLETED, outbox, recalc)
Refund: initiateRefund → approveRefund → processRefund (wallet/CN executed; cash record-only) → recalc
Cancel: unwindOrderFinancialsOnCancel (+ post-tx refunds per payment row)
AR: ar-invoice.service (create/issue/allocate/write-off routes) → ERP dispatch on invoice-created
     (expenses module also posts expense-recorded and petty-cash)
Reconciliation: runReconciliation (35 checks) + per-order financial-reconcile routes
Reports/receipts: order-financial-summary.service.ts (canonical snapshot reader)
```

# 3. Canonical Authorities

| Domain | Authority (file :: function) |
|---|---|
| Pre-persist calculation | order-calculation.service.ts :: `calculateOrderTotals` (:99) |
| Submit orchestration | order-submit-orchestrator.service.ts :: `submitOrder` |
| Settlement planning | order-settlement-planner.service.ts :: `buildSettlementPlan` (:72) |
| Initial settlement | order-settlement.service.ts :: `settleOrderTx` (:135) |
| Later settlement | order-settlement.service.ts :: `collectPaymentTx` (:622) |
| Financial snapshot writer | order-financial-write.service.ts :: `recalculateOrderFinancialSnapshotTx` (:522) |
| Snapshot read model | order-financial-summary.service.ts :: `getOrderFinancialSummary` (:385) |
| Refund workflow | order-refund.service.ts (initiate :142 / approve :365 / process :418) |
| Cancellation unwind | order-cancel-financials.service.ts :: `unwindOrderFinancialsOnCancel` (:206) |
| BVM post + wiring | voucher-wiring.service.ts :: `postAndWireBizVoucher` (:336) |
| ERP-Lite GL engine / adapter | erp-lite-posting-engine.service.ts (:141) / erp-lite-auto-post.service.ts (:80) |
| Reconciliation | reconciliation.service.ts + reconciliation/order-checks.ts |
| Cash-drawer close | cash-drawer.service.ts :: `closeSession` (:1415) |
| AR invoice + allocation | ar-invoice.service.ts (`allocateArPaymentTx` :576) |
| Customer receipts | customer-receipt-posting.service.ts :: `postCustomerAccountReceipt` (:39) |

# 4. Current Commercial Calculation Formulas

Authority `calculateOrderTotals`; rounding `Number(x.toFixed(dp))`, dp from tenant currency config (default **3**, :131).

| Value | Exact formula as executed | Line |
|---|---|---|
| subtotal | Σ((priceOverride ?? basePrice)×qty + servicePrefCharge + packingPrefCharge) | :167–181 |
| manual discount | pct>0 → min(sub×pct/100, sub) else min(amount, sub); percent wins, never both | :183–195 |
| auto-rule discount | min(best single rule, afterManual) | :202–215 |
| promo | stackable → applied after auto rule; else larger of promo/auto wins | :222–258 |
| afterDiscounts | max(0, subtotal − manual − auto − promo) | :260 |
| tax lines | per profile: non-compound first; compound base = base+priorTax; round(base×rate/100, dp); exemption → [] | tax-engine.service.ts:146–171 |
| tax fallback | no profiles → tenant VAT rate × afterDiscounts (+ additionalTax param) | :292–305 |
| saleTotal | afterDiscounts + VAT + additionalTax (**always adds tax — no TAX_INCLUSIVE branch**) | :309–340 |
| gift card | min(requested, balance, saleTotal) — settlement credit, not a discount | :314–338 |

**Confirmed limitation:** order-level `chargeLines` are always `[]` on submit (orchestrator:989); charges exist only in the snapshot/read/recon layers. `ITEM/PREF CALC: IMPLEMENTED` · `ORDER-CHARGE FACT PARITY: PARTIAL`.

# 5. Canonical Snapshot Calculation

Authority `recalculateOrderFinancialSnapshotTx`; all sums from fact rows in the caller's tx; tolerance 0.001; `round4` money.

```text
totalAmount = max(0, round4(itemsBase + charges − discounts + taxAddend + rounding_adjustment))
  taxAddend = 0 when TAX_INCLUSIVE else totalTax          (:285–336; mode via pricing-mode-resolver)
paid        = Σ REAL_PAYMENT rows in COMPLETED lifecycle set (nature filter :128)
credits     = Σ credit apps APPLIED (:698)
outstanding = max(0, total − paid − credits + refundReopensDue + creditReversalReopensDue) (:779)
overpaid    = max(0, paid+credits−total − changeReturned − disposedOverpayment) (:787)
netCollected= max(0, paid − realPaymentRefunded); payOnCollection/arReceivable = outstanding by payment_type (:795)
base_cur_*  = round4(amount × currency_ex_rate) (:88)
status ladder: OVERPAID → PAID → PARTIALLY_PAID → PENDING_COLLECTION → UNPAID (:450–472)
```

Persists ~45 canonical `org_orders_mst` columns + engine version 5, JSON snapshot, md5 hash, trace id, warning codes, snapshot status CURRENT/MISMATCH/RECALCULATION_REQUIRED. Tax-base buckets (non-taxable/exempt/zero-rated/out-of-scope) hardcoded 0 (:694–697).

## 5.1 Payment lifecycle status sets (constants/order-financial.ts:464–469)

| Set | Values | Snapshot treatment |
|---|---|---|
| COMPLETED | COMPLETED, CAPTURED, SETTLED | counted in `total_paid_amount` |
| PENDING | PENDING, PROCESSING, CAPTURE_PENDING | `pending_payment_amount`; NOT paid |
| AUTHORIZED | AUTHORIZED | `authorized_payment_amount`; NOT paid |
| FAILED | FAILED, CANCELLED, EXPIRED, VOIDED, REFUSED, REVERSED | `failed_payment_amount`; NOT paid |

Note: the FAILED vocabulary (CANCELLED/VOIDED/REVERSED…) exists and the snapshot aggregates it correctly, but **no service performs those transitions** — the only implemented transition is PENDING → COMPLETED via `verifyPaymentTx` (H8). The status registry is ahead of the runtime.

## 5.2 Warning codes emitted by `buildWarningCodes` (write:361–429)

| Code | Trigger | Effect on snapshot status |
|---|---|---|
| ORDER_TOTAL_COMPONENT_MISMATCH | header total ≠ recomputed (tol 0.001) | MISMATCH |
| DISCOUNT_TOTAL_MISMATCH / TAX_TOTAL_MISMATCH / OUTSTANDING_MISMATCH | header vs recomputed drift | MISMATCH |
| PENDING_PAYMENT_COUNTED_AS_PAID | any `pending_payment_amount > 0` — fires on every by-design pending leg (misleading name; flags healthy check/bank orders as MISMATCH) | MISMATCH |
| AUTHORIZED_PAYMENT_COUNTED_AS_PAID | any authorized amount > 0 | MISMATCH |
| GIFT_CARD_DOUBLE_COUNTED | GC applied > total credits | MISMATCH |
| CREDIT_APPLICATION_COUNTED_AS_DISCOUNT | credit-type rows found in discounts table | MISMATCH |
| AR_RECEIVABLE_MISMATCH | AR invoice outstanding ≠ `ar_receivable_amount` | MISMATCH |
| TAX_DOCUMENT_TOTAL_MISMATCH | linked tax doc total ≠ order total (inert — no docs issued, §41) | MISMATCH |
| REFUND_SOURCE_UNCLASSIFIED / PAYMENT_TARGET_UNCLASSIFIED | heuristic classification failed | RECALCULATION_REQUIRED |
| LEGACY_FIELD_USED_IN_SUMMARY | header-total fallback used (no detail rows) | RECALCULATION_REQUIRED |

`SNAPSHOT WRITER: IMPLEMENTED` · `INPUT SEMANTICS (refunds, rounding, tax docs, charges): PARTIAL` · `PENDING-warning semantics: confirmed warning-logic defect (M9/B33)`.

# 6. Payment and Settlement

| Capability | Status | Note |
|---|---|---|
| Cash / card / check / bank / mobile legs | IMPLEMENTED | D9 method config (`org_payment_methods_cf`) drives status, references, drawer, overpayment |
| Leg default status | IMPLEMENTED_WITH_CONSTRAINTS | fallback hardcodes CASH/CARD→COMPLETED, gateway→PROCESSING (planner:35) |
| Split + partial at submit | IMPLEMENTED | remainder → PAY_ON_COLLECTION or CREDIT_INVOICE (planner:174) |
| Tendered/change | IMPLEMENTED | change = subMoney(tendered, amount); tendered<amount throws (planner:289) |
| Overpayment disposition | IMPLEMENTED | validator + `org_fin_overpay_disp_dtl` + allocation preview executor; resolution codes (settlement-catalog.ts:14–24): RETURN_CASH_CHANGE, VOID_OR_REFUND_EXCESS, SAVE_AS_CUSTOMER_ADVANCE, SAVE_TO_CUSTOMER_WALLET, SAVE_AS_CUSTOMER_CREDIT, RESTORE_STORED_VALUE, ALLOCATE_TO_CUSTOMER_BALANCES, AUTO_ALLOCATE_TO_CUSTOMER_BALANCES; `REDUCE_PAYMENT` is catalogued but **not executable** — the executor throws MISMATCH if it reaches disposition (client-side-only resolution, overpayment-disposition.service.ts:137–138) |
| Payment verification | IMPLEMENTED_WITH_CONSTRAINTS | verifyPaymentTx: FOR UPDATE, idempotent, outbox; route + per-payment UI button exist; verify-only — no cancel/fail transition, no pending worklist (H8) |
| Gateway capture/webhook | NOT_FOUND | legs park in PENDING/PROCESSING; manual verify only |
| Later collection | PARTIAL | see §32 — no BVM, weak idempotency, recon conflict |
| AR invoice at submit | IMPLEMENTED | receivable-only, sized to `correctedOutstanding` (orchestrator:639–655) |
| Customer receipts / allocation | IMPLEMENTED | voucher-based; GL posting DISCONNECTED |
| B2B statement payments | IMPLEMENTED_WITH_CONSTRAINTS | idem-guarded (mig 0380); GL posting DISCONNECTED |

Cash rule: `changeReturned = max(0, tendered − applied)`; drawer retains `tendered − change`; tendered is never revenue.

# 7. Credits and Stored Value

Fact table `org_order_credit_apps_dtl`; ledgers `org_customer_wallets_mst`+`org_wallet_txn_dtl`, `org_customer_advances_mst`+txn, `org_credit_notes_mst`, `org_gift_cards_mst`+txn, `org_loyalty_txn_dtl`. Controls: FOR UPDATE locking, STORED_VALUE_LOCK_RANK ordering (constants/order-financial.ts:127), idempotency-skip, voucher backlinks (mig 0329), strict separation from `total_amount`.
`APPLICATION AT SETTLEMENT: IMPLEMENTED` · `ISSUANCE-SIDE CAPTURE (GC sale, wallet top-up, advance receipt): PARTIAL — ledger rows written, but no tender/payment fact, BVM voucher, cash-drawer movement, or ERP-Lite GL posting is created (§33)` · `ACCOUNTING AUTO-POST: DISCONNECTED` · `LOYALTY EARN ON SETTLE: DISCONNECTED — queueEarnPoints emits LOYALTY_EARN only; processEarnPoints has no production caller (H7)` · `LOYALTY CANCEL RESTORE: PARTIAL (manual)`.
Concern: loyalty points = `ceil(amount / (option.minAmount ?? 1))` — `min_amount` reused as conversion rate (order-settlement.service.ts:317).

# 8. Refunds, Reversals, and Voids

Workflow `PENDING_APPROVAL → APPROVED → PROCESSED` with maker-checker, `fn_next_fin_doc_no` REF- numbering, caps vs paid+credits−refunded and per-source remainders, FOR UPDATE process lock, `uq_refund_idempotency`.

## 8.1 Stage-by-stage controls (order-refund.service.ts)

| Stage | Function | Controls executed | Financial effect |
|---|---|---|---|
| Initiate | `initiateRefund` (:142) | amount>0; MANUAL_EXCEPTION forbids lineage + requires note (:167–176); idempotent replay (:183); refundable-balance cap (:203); per-payment remainder cap (:231–248); per-credit-app remainder cap (:251–295); POS-session gate; REF- number via row-locked sequence (:303) | none — row only (`PENDING_APPROVAL` or `APPROVED` if `approvalRequired=false`) |
| Approve | `approveRefund` (:365) | status guard PENDING_APPROVAL; approver stamped in row + metadata; outbox APPROVED stage | none |
| Process | `processRefund` (:418) | FOR UPDATE on refund row (:430); re-check refundable balance; WALLET → `topUpWalletTx`; CREDIT_NOTE → `issueCreditNoteTx` (idem `refund-${id}-cn`); CASH/ORIGINAL_METHOD → **record-only**; snapshot recalc; outbox PROCESSED stage | wallet/CN ledger credit only; no drawer OUT, no gateway call, no voucher, no GL, no reopen of due |

Refund vocabularies (constants/order-financial.ts): `REFUND_METHODS` = ORIGINAL_METHOD, CASH, CREDIT_NOTE, WALLET (:181–186); `REFUND_SOURCE_TYPES` = REAL_PAYMENT_REFUND, GIFT_CARD_RESTORE, WALLET_RESTORE, CUSTOMER_ADVANCE_RESTORE, CUSTOMER_CREDIT_ISSUE, CREDIT_NOTE_ISSUE, MANUAL_EXCEPTION (:148–156) — the source-type registry exists but the write path never populates the column (C1).

## 8.2 Missing execution semantics

**Critical missing semantics (confirmed):** `initiateRefund` create block (order-refund.service.ts:311–335) writes neither `refund_source_type` nor `reopens_due_amount` (lineage only in metadata JSON). The snapshot classifier then relies on the legacy heuristic fallback (order-financial-write.service.ts:215–248), and outstanding never reopens:

```text
paid order → cash refund PROCESSED → outstanding stays 0 → payment_status stays PAID
```

| Destination | Status |
|---|---|
| Wallet restore | IMPLEMENTED (`topUpWalletTx`) |
| Credit-note issue | IMPLEMENTED (`issueCreditNoteTx`, idem `refund-${id}-cn`) |
| Cash / original method | PARTIAL — record-only; drawer movement not written by processRefund |
| Gateway reversal | NOT_FOUND |
| Refund BVM voucher (`REFUND_VOUCHER`) | DISCONNECTED — type exists (constants/voucher.ts:60), no production caller |
| Refund ERP journal | DISCONNECTED |
| Reopen of due | NOT_FOUND in refund service |

BVM voucher reversal ≠ payment reversal ≠ stored-value restore ≠ drawer reversal ≠ GL reversal — a `REVERSED` voucher alone proves none of the operational unwinds.
`REQUEST/APPROVAL/CAPS/LOCKING/IDEMPOTENCY: IMPLEMENTED (controls only)` · `EXECUTION: PARTIAL` · `END-TO-END REFUND: NOT_READY`.

# 9. Order Cancellation and Financial Unwind

`unwindOrderFinancialsOnCancel`: reverses APPLIED credit apps to ledgers, computes `paidNet = Σ(amount − change)`, requires disposition (REFUND / STORE_CREDIT / KEEP_ON_ACCOUNT, throws `CANCEL_DISPOSITION_REQUIRED`), reverses promo usage, recalcs snapshot, emits `ORDER_CANCEL_FINANCIAL_UNWIND`. REFUND disposition creates refund rows post-tx (inherits §8 gaps). Loyalty → warning only (:190). Hardcoded `'OMR'` fallback (:290). Tax-document/GL adjustment on cancel: NOT_FOUND.
`UNWIND FOUNDATION: IMPLEMENTED` · `END-TO-END PARITY: PARTIAL` — full matrix in §30.

# 10. Order Edit and Financial Mutation

Item add/delete runs through `lib/db/orders.ts::recalculateOrderTotals` (:867–939): independent math, **inclusive reverse-split** `subtotal = total/(1+vat)`, **hardcoded `vat_rate` fallback `0.05`** (:917), then calls the canonical snapshot recalc. Entry point: POST `/api/v1/preparation/[id]/items` → `addOrderItems`. No amendment record, no delta, no repricing via `calculateOrderTotals`, no settlement consequence.
`BASIC ITEM EDIT: IMPLEMENTED (UNSAFE_DIRECT_UPDATE header write)` · `OrderAmendmentService / delta model / immutable amendment record: NOT_FOUND` — full matrix in §29.

# 11. BVM Operational Voucher Layer

Flow `createBizVoucher → addVoucherLine → postBizVoucher → postAndWireBizVoucher → wiring handlers` (order-payment, order-credit-application, cash-drawer, invoice-payment, statement-payment). Tables `org_fin_vouchers_mst`, `org_fin_voucher_trx_lines_dtl`; line-role/target validation via `LINE_ROLE_REQUIREMENTS` (constants/voucher.ts:293). BVM is operational only; `posting_status`/GL is ERP-Lite's.
`INITIAL SUBMIT BVM: IMPLEMENTED` · `LATER-COLLECTION BVM: NOT_FOUND` · `REFUND BVM: DISCONNECTED` · `REVERSAL OPERATIONAL UNWIND: PARTIAL` — catalogue in §38.

# 12. ERP-Lite Accounting Layer

Engine (`ErpLitePostingEngineService`): governance packages/rules, usage-code→account resolution, open-period check, balanced journals (`org_fin_journal_mst/_dtl`), logs/exceptions/snapshots, per-(doc,event,key) idempotency, preview/execute/retry/repost. Adapter (`ErpLiteAutoPostService`): dispatchers for invoice, payment, refund, petty cash, 6 gift-card events.
Runtime callers: **only** `dispatchInvoiceCreatedInTransaction` (ar-invoice.service.ts:1663), `dispatchExpenseRecordedInTransaction` (erp-lite-expenses.service.ts:244), and `dispatchPettyCashTransactionInTransaction` (erp-lite-expenses.service.ts:412). Payment, refund, gift-card, and wallet-settlement posting is DISCONNECTED (dispatchers/event codes exist — including `ORDER_SETTLED_WALLET`, erp-lite-posting.ts:73 — but no callers); wallet top-up, advance, loyalty-liability, AR-allocation, and the other missing event families are NOT_FOUND (no event codes exist) — full event matrix in §39.
`ENGINE: IMPLEMENTED` · `ORDER-TO-CASH GL INTEGRATION: NOT_READY` · `BVM→GL BRIDGE: NOT_FOUND`.

# 13. Reconciliation

Framework: `runReconciliation` executes 35 checks (reconciliation.service.ts:73–117) persisted to `org_fin_recon_runs_mst`; per-order live routes exist.

**Critical formula divergence (confirmed) — side by side:**

```text
Reconciliation (order-checks.ts:198–200)                Snapshot (order-financial-write.service.ts:779–786)
expectedOutstanding =                                   outstanding =
  max(0, total_amount                                     max(0, totalAmount
    − Σ payments WHERE status = 'COMPLETED' (literal)       − Σ payments IN COMPLETED lifecycle set (§5.1)
    − Σ credit apps WHERE is_active (ANY status, :140)      − Σ credit apps WHERE status = APPLIED
    + Σ PROCESSED refunds (ALL sources))                    + refund_reopens_due (never written — always 0)
                                                            + credit_reversal_reopens_due (hardcoded 0))
```

Four independent drift sources: payment-status set (literal `'COMPLETED'` misses CAPTURED/SETTLED), credit-status filter (recon counts PENDING/REVERSED apps), refund treatment (all refunds vs never-populated reopen), and reversal semantics. Any processed refund — and any REVERSED credit app left `is_active` — produces a permanent OUTSTANDING_TOTAL_MATCH / CREDIT_APP_BALANCE blocker on a snapshot that is internally self-consistent. Reconciliation re-implements formulas instead of calling shared aggregation.
Other issues: TAX_CALCULATION / DISCOUNT_VALIDATION constants unimplemented (:66–71); voucher-link checks conflict with the collect path; drawer aggregate unfiltered.
`FRAMEWORK: IMPLEMENTED` · `FORMULA AUTHORITY: PARTIAL` · `AS CLOSING CONTROL: NOT_READY`. Rule: **reconciliation must consume the snapshot's shared aggregation.**

# 14. Tax, Tax-Inclusive Pricing, and Tax Documents

Tax-exclusive checkout: profiles, exemptions, compound, tenant fallback, detail facts, snapshot totals → `IMPLEMENTED_WITH_CONSTRAINTS`.
Tax-inclusive: snapshot handles `taxAddend=0`, but preview/submit **always add tax** (§4) and the item-edit path assumes inclusive — three inconsistent behaviors → `END-TO-END TAX-INCLUSIVE: NOT_READY`.
Tax documents: `tax-document-write.service.ts` (numbering via decision/sequence services, e-invoice activation check) has **no production caller**; order snapshot lineage taxDocument* fixed null (order-financial-write.service.ts:924) → `DISCONNECTED`. Full lifecycle in §41.

# 15. Currency, Precision, Rounding, and FX

Storage DECIMAL(19,4); Decimal helpers (`lib/utils/money.ts`, MONEY_SCALE=4); snapshot round4; preview uses JS Number/`toFixed`; display dp default 3.
**Hardcoded defaults (confirmed):** `'OMR'` ×8 services (stored-value.service.ts:46,194; order-refund:483; order-cancel-financials:290; order-settlement:666; order-credit-application:341; customer-open-balance-query:264; collection-overpayment:93; customer-receipt-allocation-preview:231); `'USD'` ORDER_DEFAULTS.CURRENCY (order-defaults.ts:10); VAT `0.05` (lib/db/orders.ts:917); UI taxRate `0.06` (use-payment-totals.ts:176); tolerances 0.001 (submit/snapshot) vs 0.01 (drawer).
Rounding: `rounding_adjustment_amount` read in the total formula, **no writer**; `sys_currency_rounding_rules_cd` seeded (mig 0290), not consumed → `CONFIGURED_ONLY`.
FX: single `currency_ex_rate` per order (default 1, order-service.ts:672); base-currency projection only; no rate table/history, no revaluation, no realized gain/loss → `FULL MULTI-CURRENCY ACCOUNTING: NOT_FOUND`. Lifecycle in §42.

# 16. Transactions, Locking, and Idempotency

Strong: submit staked-hash idempotency with 409 conflict/prior-failure handling (submit-order/route.ts:99–257); one tx for order+voucher+debits+settle+snapshot; FOR UPDATE on balances/verify/refund/collect-header; deterministic lock ranks; sub-keys `${orderId}_vch|_vl_*|_sv_*|_ar|_vch_post`; voucher-post 7-day cache; outbox in-tx.
Gap: `collectPaymentTx` payment inserts have **no idempotency-skip** (key guards only pos-link/disposition, :640) and the key is optional on both collect routes → retry can duplicate payment + drawer rows.
`SUBMIT: IMPLEMENTED` · `REFUND: IMPLEMENTED (controls only)` · `LATER COLLECTION: PARTIAL`.

# 17. Cash Drawer and POS Session

Implemented: POS-session gating (`assertOpenPosSessionForFinanceTx`), drawer sessions, opening float, CASH_SALE/CASH_OUT movements, close with `expected = float + Σ sessionPayments + IN − OUT`, `variance = counted − expected`, balanced iff |v|<0.01 (cash-drawer.service.ts:1448–1457).
Gap: the session-payment aggregate (:1428) filters neither `payment_status='COMPLETED'` nor `is_active` → variance can misreport. Safe drop / pickup / drawer-to-safe / bank deposit: NOT_FOUND (§40).
`CASH DRAWER: IMPLEMENTED_WITH_CONSTRAINTS` — expected-cash aggregation does not filter to active, financially successful payments.

# 18. Duplicate, Legacy, and Alternative Logic

| Location | Class | Risk |
|---|---|---|
| lib/utils/pricing-calculator.ts (`calculateOrderTotal`:252, `calculateTax`:378) | DUPLICATED | independent tax/item math feeding item-edit + UI tables |
| lib/db/orders.ts `recalculateOrderTotals`:867 | LEGACY + UNSAFE_DIRECT_UPDATE | tax-mode divergence, 0.05 fallback, direct header write |
| lib/utils/order-item-helpers.ts:113 | DUPLICATED | alternative line sum (UI) |
| invoice-service.ts calc block :410–519 | LEGACY | unrounded direct `org_invoice_mst.total` update (`applyDiscountToInvoice`:482) |
| use-payment-totals.ts fallback :375–427 | UI-ONLY | omits server rules; 0.06 default |
| preview-payment ≡ preview-financials; collect-payment ≡ [id]/payments | DUPLICATED routes | contract drift |
| `toFinancialBreakdownSnapshot` vs orchestrator inline breakdown | DUPLICATED adapters | snapshot construction drift |
| `settleOrder(wiringMode:false)` branch | LEGACY | non-BVM direct fact writes still executable (order-settlement.service.ts:246) |
| `PAYMENT_METHODS` in constants/order-types.ts **and** constants/payment.ts | DUPLICATED constants | orchestrator imports one, settlement the other (§44) |
| `VOUCHER_TYPE_LEGACY` vs `VOUCHER_TYPE` | LEGACY constants | two voucher-type vocabularies (constants/voucher.ts:27/57) |
| org_payments_dtl_tr | RETIRED | dropped mig 0395 |
| payment-modal v3 / enhanced-02 | RETIRED | `.tsx.bak` |

# 19. Consolidated Capability Matrix

| Capability | Status | Capability | Status |
|---|---|---|---|
| Item/preference pricing | IMPLEMENTED | Refund approval workflow | IMPLEMENTED (controls only) |
| Manual/auto/promo discounts | IMPLEMENTED | Refund financial execution | PARTIAL |
| Order-level charges | PARTIAL | Refund reopen-of-due | NOT_FOUND |
| Tax-exclusive checkout | IMPLEMENTED_WITH_CONSTRAINTS | Gateway refund | NOT_FOUND |
| Tax-inclusive end-to-end | NOT_READY (PARTIAL) | Cancellation unwind | PARTIAL |
| Split / partial payments | IMPLEMENTED | Post-payment amendment orchestration | NOT_FOUND |
| Cash tendered/change | IMPLEMENTED | Snapshot writer v5 | IMPLEMENTED |
| Overpayment disposition | IMPLEMENTED | Initial-submit BVM | IMPLEMENTED |
| Pay-on-collection creation | IMPLEMENTED | Later-collection BVM | NOT_FOUND |
| Later collection | PARTIAL | Refund BVM | DISCONNECTED |
| Gateway callback/capture | NOT_FOUND | BVM reversal unwind | PARTIAL |
| Wallet/advance/CN application | IMPLEMENTED | ERP journal engine | IMPLEMENTED |
| Gift-card redemption | IMPLEMENTED | ERP invoice/expense posting | IMPLEMENTED |
| GC sale / wallet top-up capture | PARTIAL (ledger only; no tender/BVM/drawer/GL) | ERP payment/refund/GC posting | DISCONNECTED |
| Loyalty redemption | IMPLEMENTED_WITH_CONSTRAINTS | Reconciliation framework | IMPLEMENTED |
| Loyalty earn on settle | DISCONNECTED (emit-only — H7) | Recon formula consistency | PARTIAL (broken vs snapshot) |
| Customer receipts/allocation | IMPLEMENTED | Cash drawer | IMPLEMENTED_WITH_CONSTRAINTS |
| B2B statements | IMPLEMENTED_WITH_CONSTRAINTS (GL gap) | Tax-document writer | DISCONNECTED |
| Base-currency projection | IMPLEMENTED | Currency rounding | CONFIGURED_ONLY |
| Submit idempotency | IMPLEMENTED | Full FX accounting | NOT_FOUND |
| Later-collection idempotency | PARTIAL | Financial outbox consumption | DISCONNECTED |

# 20. Missing or Disconnected Capabilities

Superseded by the deduplicated backlog in **§50** (single source). Headline set: refund lineage + reopen-due; shared snapshot/recon aggregation; later-collection BVM + idempotency; gateway callback/refund; ERP payment/refund/stored-value posting; tax-document runtime; rounding writer + rules consumption; tax-inclusive calc; amendment orchestration; outbox consumer; expiry jobs; GC-sale/wallet-top-up money capture; FX runtime.

# 21. Highest-Risk Inconsistencies

| # | Sev | Risk | Evidence |
|---|---|---|---|
| C1 | CRITICAL | Processed real-payment refund leaves `outstanding=0`, `PAID` | order-refund.service.ts:311 (no reopen write) |
| C2 | CRITICAL | Recon outstanding formula ≠ snapshot formula → permanent false blockers | order-checks.ts:200 vs write:779 |
| C3 | CRITICAL | GC sale / wallet top-up write stored-value ledger rows only — no tender/payment fact, BVM voucher, cash-drawer movement, or ERP-Lite GL posting is created | gift-card-service.ts:338–382; wallet/top-up/route.ts:36–43 |
| H1 | HIGH | Later collection bypasses BVM; trips own voucher-link invariant | order-settlement.service.ts:829 vs order-checks.ts:317 |
| H2 | HIGH | ERP payment/refund posting disconnected → GL blind to POS cash | §39 |
| H3 | HIGH | Tax-inclusive path inconsistent across preview/submit/edit/snapshot | §14 |
| H4 | HIGH | Voucher reversal is not an operational unwind | voucher-reversal.service.ts |
| H5 | HIGH | Later-collection retry can duplicate payment + drawer rows | order-settlement.service.ts:640 |
| H6 | HIGH | Financial outbox never consumed; retry/dead-letter machinery idle | §45 |
| H7 | HIGH | Loyalty earning is disconnected — `queueEarnPoints` emits `LOYALTY_EARN` into the financial outbox, but no runtime outbox consumer or direct `processEarnPoints` caller exists; qualifying settled orders therefore do not actually credit loyalty points | loyalty.service.ts:141 |
| H8 | HIGH | Pending-payment back-office lifecycle is verify-only: no cancel/fail/reject/bounce transition, no reason capture; the plan counts PENDING legs at full value (`outstandingPolicy='NONE'`, no AR/POC fallback), so an unverified/failed PENDING leg strands the order with real outstanding and no policy; the verification audit trail (actor in `PAYMENT_VERIFIED` payload only; row stamps generic `updated_by`) never reaches history because the outbox consumer is inactive (H6); verify also accepts **only** PENDING — gateway legs created as PROCESSING (planner:36) cannot be completed through the sole existing transition | order-settlement.service.ts:515–533; planner:169–181 |
| M1 | MED | 'OMR'/'USD'/0.05/0.06 hardcoded defaults | §15 |
| M2 | MED | Drawer expected-cash weak filtering | cash-drawer.service.ts:1428 |
| M3 | MED | Charges supported downstream, never written at submit | orchestrator:989 |
| M4 | MED | Item-edit math diverges from tax mode | lib/db/orders.ts:919 |
| M5 | MED | Precision/tolerance differ across layers | §15 |
| M6 | MED | `collectPaymentTx` ignores `default_creation_status` (column not even selected) and hardcodes non-gateway → COMPLETED — a CHECK/BANK method configured PENDING is counted as paid instantly at later collection, before clearing | order-settlement.service.ts:827 |
| M7 | LOW | Drawer wiring and drawer-close do not gate on payment status — only material if a drawer-required method is configured PENDING (CASH is normally COMPLETED instantly); defensive gate recommended | cash-drawer-wiring.handler.ts:22–29 |
| M8 | LOW | `allow_status_override` is CONFIGURED_ONLY — stored on the leg, never consulted in status resolution | planner:93 |
| M9 | MED | `PENDING_PAYMENT_COUNTED_AS_PAID` is emitted whenever `pending_payment_amount > 0`, even though pending payments are excluded from `total_paid_amount` — valid pending-method orders are therefore incorrectly marked MISMATCH | order-financial-write.service.ts:361–429 |

# 22. Safe and Restricted Operational Scope

**Safe with current constraints:** tax-exclusive checkout; configured split tender; cash tendered/change; GC/wallet/advance/CN application at settlement; pay-on-collection creation; AR invoice creation; initial BVM voucher; drawer movement from submit; manual verification of confirmed valid pending payments, with a temporary compensating audit procedure.
**Restrict / compensate manually:** tax-inclusive pricing; automated refunds; gateway refunds; voucher reversal as void; later collection without BVM compensation; reconciliation as closing blocker; ERP trial balance for POS; tax-document amendments; rounding automation; post-payment edits; currency change after settlement; GC sale / wallet top-up without manual cash capture.

# 23. Required Canonical Architecture Decisions

1. **Layers:** business event ≠ BVM voucher ≠ operational fact ≠ drawer movement ≠ GL journal.
2. **Refund classes:** REAL_PAYMENT_REFUND / STORED_VALUE_RESTORE / PAYMENT_REVERSAL / CUSTOMER_CREDIT_ISSUE / MANUAL_EXCEPTION — written on the row, not metadata.
3. **One shared aggregation** consumed by snapshot, reconciliation, receipts, balance APIs, close controls.
4. **Amendment model:** before-snapshot → mutation → canonical repricing → after-snapshot → delta → settlement consequence → tax/invoice/BVM/GL adjustment → reconcile. No CRUD writes to totals.
5. **BVM = operational governance; ERP-Lite = debit/credit accounting.**

# 24. Remediation Priority

| Phase | Content |
|---|---|
| 0 Freeze semantics | payment lifecycle statuses; refund classes; reopen-due rules; BVM vs GL; amendment rules |
| 1 Financial blockers | write refund lineage + `reopens_due_amount`; shared snapshot/recon aggregation; refund regression tests |
| 2 Later collection | route via BVM; required key; per-leg idempotency; drawer/receipt parity; recon green |
| 3 Money capture & tax/rounding | GC-sale/top-up payment facts; canonical tax-inclusive; remove 0.05/'OMR'/'USD'; rounding writer + rules |
| 4 Accounting wiring | payment/refund/stored-value posting; revenue-recognition event; BVM↔GL reconciliation |
| 5 Reversal & amendment | operational voucher reversal; payment reversal; drawer + GL reversal; amendment/delta workflow |
| 6 Tax documents | connect writer; tax credit/debit notes; lineage into snapshot/recon; e-invoice runtime |

# 25. Required Test Matrix

Superseded by the scenario matrix in **§49** — every §49 row requires: formula assertion, fact-row assertion, BVM parity, drawer/GL assertion where applicable, snapshot=reconciliation equality, duplicate-retry and concurrency variants.

# 26. Evidence Index

Core: order-calculation.service.ts · order-submit-orchestrator.service.ts · order-settlement-planner.service.ts · order-settlement.service.ts · order-financial-write.service.ts · order-financial-summary.service.ts · order-refund.service.ts · order-cancel-financials.service.ts · order-adjustment.service.ts · voucher-{biz,line,posting,wiring,reversal}.service.ts · erp-lite-{auto-post,posting-engine,expenses}.service.ts · ar-invoice.service.ts · customer-receipt-{posting,allocation-*,excess-executor}.service.ts · b2b-statement-payment.service.ts · reconciliation.service.ts + reconciliation/* · cash-drawer.service.ts · pos-session.service.ts · stored-value.service.ts · gift-card-service.ts · loyalty.service.ts · tax-engine.service.ts · tax-document-{decision,sequence,write}.service.ts · e-invoice.service.ts · outbox.service.ts · order-history-consumer.service.ts · lib/db/orders.ts · invoice-service.ts · lib/utils/{money,pricing-calculator,order-item-helpers}.ts · constants/{order-financial,payment,order-types,voucher,settlement-catalog,erp-lite-posting,order-defaults}.ts · hooks/use-payment-totals.ts · routes under app/api/v1/{orders,ar,customers,finance,gift-cards,pos-sessions,cash-drawers,b2b} · migrations 0290, 0329, 0333–0342, 0380, 0395–0400.

# 27. Final Authoritative Verdict (superseded by §51)

The single-block verdict of the previous revision is replaced by the per-domain verdicts in **§51**. Summary retained: initial tax-exclusive checkout is READY_WITH_CONSTRAINTS; the full financial lifecycle (refunds, later collection, amendments, GL, tax documents, FX) is not.

---

# 28. Complete Financial Transaction Catalogue

Registry of transaction types found (from constants, services, outbox events, migrations, UI actions) plus required-but-absent ones. Columns: **St**=current status, **Auth**=authority, **Facts**=tables written, **BVM/Cash/GL** effects, **Rev**=reversal event, **Idem**=idempotency, **Gap**=main gap. GL column states the *expected* ERP event; `—` = none today.

**Order commercial / pricing / charges / discounts / promotions / tax**

| Code | St | Auth | Facts | BVM | Cash | GL (expected) | Rev | Idem | Gap |
|---|---|---|---|---|---|---|---|---|---|
| ORDER_CREATED | IMPLEMENTED | OrderService.createOrderInTransaction | org_orders_mst, items, pieces, preferences | none | none | — (deferred to settle/invoice) | ORDER_CANCELLED | route hash | — |
| ORDER_PRICED (preview) | IMPLEMENTED | calculateOrderTotals | none (stateless) | — | — | — | n/a | n/a | no TAX_INCLUSIVE branch |
| ORDER_REPRICED | NOT_FOUND | — | — | — | — | — | — | required | no canonical repricing after create |
| ORDER_CHARGE_APPLIED | PARTIAL | settleOrderTx §1 (org_order_charges_dtl) | charges table | in voucher total only | none | — | CHARGE_VOIDED (is_voided col exists, no writer) | required | submit always passes `[]` |
| ORDER_DISCOUNT_APPLIED | IMPLEMENTED | settleOrderTx §3 | org_order_discounts_dtl | none | none | — (contra-revenue) | DISCOUNT_VOIDED (is_voided, no writer) | seq-based | no void/change flow |
| PROMO_APPLIED | IMPLEMENTED | applyPromoCodeTx | promo usage log | none | none | — | PROMO_REVERSED — IMPLEMENTED (`reversePromoUsageTx` on cancel) | keyed | — |
| ORDER_TAX_APPLIED | IMPLEMENTED | settleOrderTx §2 | org_order_taxes_dtl | none | none | — (tax liability) | required on cancel/refund — NOT_FOUND | seq | no tax reversal facts |
| ORDER_ADJUSTMENT_CREATED | IMPLEMENTED_WITH_CONSTRAINTS | createOrderAdjustment (order-adjustment.service.ts:46) | adjustments ledger + outbox | none | none | — | required | required | isolated ledger; no snapshot/GL linkage proven |

**Settlement / real payments**

| Code | St | Auth | Facts | BVM | Cash | GL (expected) | Rev | Idem | Gap |
|---|---|---|---|---|---|---|---|---|---|
| ORDER_SETTLED (submit) | IMPLEMENTED | submitOrder tx | payments, credit apps, drawer mov. | RECEIPT_VOUCHER + lines | CASH_SALE IN + change OUT | PAYMENT_RECEIVED / ORDER_SETTLED_* — DISCONNECTED | per-leg refund/reversal | strong sub-keys | GL not wired |
| PAYMENT_RECEIVED (later) | PARTIAL | collectPaymentTx | payments, drawer mov. | NONE | CASH_SALE/CASH_OUT | PAYMENT_RECEIVED — DISCONNECTED | refund only | weak | no voucher; dup-retry risk |
| PAYMENT_VERIFIED | IMPLEMENTED_WITH_CONSTRAINTS | verifyPaymentTx | payment status flip + outbox | none | none | — | n/a | idempotent replay | outbox unconsumed; verify-only lifecycle (H8) |
| PAYMENT_FAILED / CANCELLED / VOID | PARTIAL / NOT_FOUND | status constants only | payment_status values exist | — | — | — | — | — | no transition service |
| OVERPAYMENT_DISPOSED | IMPLEMENTED | executeOverpaymentDispositionTx | org_fin_overpay_disp_dtl (+wallet/advance/CN) | linked voucher optional | change OUT when cash | — | required | keyed | GL none |

**Stored value / refunds / reversals / cancellation** — see §33/§34/§30 for lifecycles; catalogue rows:

| Code | St | Auth | Facts | BVM | Cash | GL (expected) | Rev | Idem | Gap |
|---|---|---|---|---|---|---|---|---|---|
| GIFT_CARD_SOLD | PARTIAL | sellGiftCard (:314) | GC mst + txn (SALE) | NONE | NONE | GIFT_CARD_SOLD — DISCONNECTED | GIFT_CARD_VOIDED | none | no tender/BVM/drawer/GL capture |
| GIFT_CARD_REDEEMED | IMPLEMENTED | redeemGiftCardTx via settlement | GC txn + credit app | CREDIT_APPLICATION line | none | GIFT_CARD_REDEEMED — DISCONNECTED | refundGiftCardTx | keyed | GL |
| WALLET_TOPPED_UP | PARTIAL | topUpWalletTx (route/actions) | wallet txn (TOP_UP) | NONE | NONE | WALLET_TOPPED_UP — NOT_FOUND (no event code) | adjustment | none | no tender/BVM/drawer/GL capture |
| WALLET_APPLIED / ADVANCE_APPLIED / CN_APPLIED / LOYALTY_REDEEMED | IMPLEMENTED | applyStoredValueDebitTx dispatch | ledgers + credit app | CREDIT_APPLICATION line | none | ORDER_SETTLED_WALLET — DISCONNECTED | cancel unwind restore | keyed | GL |
| LOYALTY_EARNED | DISCONNECTED | queueEarnPoints (emit-only, loyalty.service.ts:141) | outbox LOYALTY_EARN event only | none | none | LOYALTY_LIABILITY_CREATED — NOT_FOUND | earn reversal — NOT_FOUND | n/a | no outbox consumer / processEarnPoints caller (H7) |
| CREDIT_APPLICATION_REVERSED | IMPLEMENTED | reverseCreditApplicationTx (cancel) | ledger restore, status REVERSED | none | none | — | n/a | keyed | not usable outside cancel |
| REFUND_INITIATED/APPROVED/PROCESSED | PARTIAL | order-refund.service.ts | org_order_refunds_dtl (+wallet/CN) | NONE | NONE (cash record-only) | REFUND_ISSUED — DISCONNECTED | n/a | unique key | lineage cols, reopen, drawer, GL |
| ORDER_CANCEL_FINANCIAL_UNWIND | PARTIAL | unwindOrderFinancialsOnCancel | reversals + CN + outbox | none | none | — | n/a | keyed steps | voucher/drawer/GL/tax parity |

**AR / receipts / cash drawer / gateway / bank / BVM / ERP / tax docs / FX / reconciliation**

| Code | St | Auth | Facts | BVM | Cash | GL (expected) | Rev | Idem | Gap |
|---|---|---|---|---|---|---|---|---|---|
| AR_INVOICE_ISSUED | IMPLEMENTED | createArInvoiceFromOrders | org_invoice_mst/orders_dtl | none | none | ORDER_INVOICED — IMPLEMENTED | void/write-off routes | `${orderId}_ar` | — |
| AR_PAYMENT_ALLOCATED | IMPLEMENTED | allocateArPaymentTx | org_invoice_payments_dtl | INVOICE_PAYMENT line (via receipts) | per method | — DISCONNECTED | unallocate NOT_FOUND | keyed | GL; unallocation |
| AR_WRITE_OFF | PARTIAL | /ar/invoices/[id]/write-off + `invoices:write_off` | invoice status | none | none | — NOT_FOUND | reversal NOT_FOUND | UNVERIFIED | GL posting unproven |
| CUSTOMER_RECEIPT_POSTED | IMPLEMENTED | postCustomerAccountReceipt | receipt + allocations | receipt voucher lines | drawer per method | — DISCONNECTED | reallocation PARTIAL | keyed | GL |
| B2B_STATEMENT_PAYMENT | IMPLEMENTED_WITH_CONSTRAINTS | b2b-statement-payment.service | org_b2b_statement_payments_dtl | STATEMENT_PAYMENT line | per method | — DISCONNECTED | NOT_FOUND | unique idx (0380) | GL |
| CASH_MOVEMENT (IN/OUT/PETTY) | IMPLEMENTED | recordMovement (:1489) | org_cash_drawer_movements_dtl | none | drawer | PETTY_CASH_* — IMPLEMENTED (expenses path) | NOT_FOUND | none | manual movement idem |
| DRAWER_CLOSED / VARIANCE | IMPLEMENTED_WITH_CONSTRAINTS | closeSession | session close cols | none | variance | CASH_VARIANCE — NOT_FOUND | force-close | n/a | filtering; variance GL |
| GATEWAY_CAPTURED/WEBHOOK | NOT_FOUND | — | — | — | — | — | — | required | no callback route |
| CHECK_CLEARED / BOUNCED | NOT_FOUND | verifyPaymentTx only (generic flip) | — | — | — | — | — | — | no check lifecycle |
| BANK_TRANSFER_VERIFIED | PARTIAL | verifyPaymentTx | payment flip | none | none | — | — | replay-safe | no bank clearing model |
| VOUCHER_POSTED / REVERSED | IMPLEMENTED / PARTIAL | postBizVoucher / voucher-reversal.service | voucher + lines (+reversed_line_id) | itself | via wiring | — | operational unwind NOT_FOUND | 7-day cache | reversal ≠ unwind |
| ERP_JOURNAL_POSTED | IMPLEMENTED | ErpLitePostingEngineService | journal mst/dtl + logs | n/a | n/a | itself | repost/retry in engine | per (doc,event,key) | few callers |
| TAX_DOCUMENT_ISSUED | DISCONNECTED | tax-document-write.service.ts | org_tax_documents_mst | none | none | — | replacement/cancel NOT_FOUND | seq service | no caller |
| FX_RATE_CAPTURED / FX_GAIN_LOSS | NOT_FOUND | currency_ex_rate column only | — | — | — | FX_GAIN_LOSS — NOT_FOUND | — | — | no FX runtime |
| RECONCILIATION_RUN | IMPLEMENTED | runReconciliation | recon runs + issues | n/a | n/a | n/a | n/a | run-scoped | formula divergence |

# 29. Order Amendment and Financial Mutation Coverage

Canonical `OrderAmendmentService`, financial delta model, immutable amendment record: **NOT_FOUND**. Existing mutation surfaces:

| Mutation | Route/entry | Path | Repricing | Tax recalc | Delta/settlement consequence | Status |
|---|---|---|---|---|---|---|
| ORDER_CREATED | submit-order | governed orchestration | calculateOrderTotals | yes | n/a | IMPLEMENTED |
| ORDER_ITEM_ADDED | POST /preparation/[id]/items → addOrderItems | direct db + legacy recalc | pricing-calculator (not canonical) | inclusive assumption, 0.05 fallback | none — totals overwritten, snapshot recalc only | UNSAFE_DIRECT_UPDATE |
| ORDER_ITEM_REMOVED | deleteOrderItem (lib/db/orders.ts:844) | direct delete + legacy recalc | same | same | none | UNSAFE_DIRECT_UPDATE |
| ITEM_QTY_INCREASED/DECREASED | via items update paths in lib/db/orders.ts | direct update | same | same | none | UNSAFE_DIRECT_UPDATE |
| ORDER_ITEM_PRICE_CHANGED / PRICE_OVERRIDE | `priceOverride` at create only | governed at create | canonical | yes | n/a post-create | PARTIAL (create-time only) |
| ORDER_PREFERENCE_ADDED/REMOVED | preferences/pieces routes | detail rows; snapshot picks up extras | snapshot-side | no | none | PARTIAL |
| ORDER_CHARGE_ADDED/REMOVED | NOT_FOUND (no route writes charges) | — | — | — | — | NOT_FOUND |
| ORDER_DISCOUNT_ADDED/CHANGED/REMOVED (post-create) | [id]/discounts route (read/apply at create) | no post-settlement change flow | — | — | — | NOT_FOUND |
| ORDER_PROMOTION_CHANGED | create-time only; reversal on cancel | — | — | — | — | PARTIAL |
| DELIVERY/EXPRESS option changed | order update route (non-financial fields) | — | no | no | none | NOT_FOUND (financial effect) |
| ORDER_CUSTOMER_CHANGED / BRANCH_CHANGED | [id]/update route | direct update | no | no | none | PARTIAL (no financial re-eval) |
| ORDER_CURRENCY_CHANGED | NOT_FOUND post-create | — | — | — | — | NOT_FOUND |
| ORDER_TAX_PROFILE_CHANGED | create-time selection only | — | — | — | — | NOT_FOUND post-create |
| ORDER_PAYMENT_TIMING_CHANGED | NOT_FOUND (payment_type_code set at submit) | — | — | — | — | NOT_FOUND |
| ORDER_REOPENED / TRANSFERRED / VOIDED | workflow transitions exist; financial re-eval NOT_FOUND | — | — | — | — | NOT_FOUND |

**Confirmed unsafe pattern (step by step):**

```text
POST /api/v1/preparation/[id]/items                      (route)
→ addOrderItems (lib/db/orders.ts)                       (direct row insert, pricing-calculator math)
→ recalculateOrderTotals (:867)                          (independent recompute)
   → total = Σ item.total_price                          (assumes line totals are tax-INCLUSIVE)
   → vatRate = order.vat_rate ?? 0.05                    (hardcoded fallback, :917)
   → subtotal = total / (1 + vatRate); tax = total − subtotal
   → UPDATE org_orders_mst SET subtotal/tax/total        (UNSAFE_DIRECT_UPDATE — no delta, no approval)
→ recalculateOrderFinancialSnapshot                      (canonical recalc then trusts the poisoned inputs)
```

For a TAX_EXCLUSIVE tenant the reverse-split misstates subtotal and tax; because the snapshot rebuilds from the same headers/items, the drift is masked rather than flagged. No settlement consequence is evaluated: adding items to a PAID order silently increases `outstanding` with no policy, and removing items creates `overpaid_amount` with no disposition prompt.

Common controls absent across all mutations: before/after amendment record, financial delta, additional-due collection, overpayment resolution on decrease, AR/tax-document adjustment, approval gates, per-mutation idempotency.

# 30. Order Cancellation Matrix

Common engine: `unwindOrderFinancialsOnCancel` + workflow transition (workflow-service-enhanced). Paid-value dispositions (mandatory when `paidNet > 0`, else throws `CANCEL_DISPOSITION_REQUIRED`): `REFUND` → one refund row per payment (post-tx, keyed, inherits §8 gaps) · `STORE_CREDIT` → credit note for `paidNet` (idem `cancel-${orderId}-store-credit`) · `KEEP_ON_ACCOUNT` → no mutation, outbox event is the audit record. Legend: SV=stored value.

| Scenario | Refund/reversal | SV restore | Drawer | BVM | AR/Tax doc | GL | Snapshot | Status |
|---|---|---|---|---|---|---|---|---|
| Unpaid order | n/a | n/a | n/a | none | n/a | n/a | UNPAID, total intact | IMPLEMENTED |
| Partially paid (cash) | disposition required; REFUND creates refund rows (inherit §8 gaps) | n/a | refund drawer OUT NOT_FOUND | no reversal voucher | n/a | none | recalc ok but outstanding semantics off after refund | PARTIAL |
| Fully paid cash | same | n/a | same | same | n/a | none | same | PARTIAL |
| Card / gateway paid | REFUND = record-only; no processor reversal | n/a | n/a | none | n/a | none | same | PARTIAL |
| Gift card / wallet / advance / CN legs | IMPLEMENTED — `reverseCreditApplicationTx` restores ledgers, status REVERSED | yes | n/a | no reversal line | n/a | none | credits drop out | IMPLEMENTED_WITH_CONSTRAINTS |
| Loyalty leg | warning only, manual restore | no | n/a | none | n/a | none | — | PARTIAL |
| Split settlement | combination of above | partial | partial | none | n/a | none | — | PARTIAL |
| Pay-on-collection | outstanding zeroes via recalc; no disposition needed if unpaid | n/a | n/a | none | n/a | n/a | ok | IMPLEMENTED |
| With AR invoice | invoice void route exists; auto-adjust on cancel NOT_FOUND | — | — | — | invoice left open risk | none | AR_RECEIVABLE_MISMATCH warning possible | PARTIAL |
| With issued tax invoice | NOT_APPLICABLE today (no tax docs issued) → future credit-note flow NOT_FOUND | — | — | — | — | — | — | NOT_FOUND |
| With posted GL journal | only AR-invoice journals exist; journal reversal on cancel NOT_FOUND | — | — | — | — | none | — | NOT_FOUND |
| Partially processed / completed / delivered / closed service | stage gating in workflow; charge-retention policy NOT_FOUND (no charges written) | — | — | — | — | — | — | PARTIAL |

Permissions: cancellation permission exists in workflow gating; refund disposition approval rides refund maker-checker. Charge retention, tax recalculation, and tax credit notes on cancel: NOT_FOUND across all scenarios.

# 31. Payment-Method Lifecycle Matrix

Row statuses on `org_order_payments_dtl.payment_status`; canonical sets in ORDER_PAYMENT_LIFECYCLE_STATUSES (order-financial.ts:464).

**Cash**

| Event | Status | Authority |
|---|---|---|
| CASH_RECEIVED / APPLIED | IMPLEMENTED | settle/collect; COMPLETED immediately |
| CASH_CHANGE_RETURNED | IMPLEMENTED | change col + CASH_OUT movement |
| CASH_REFUNDED | PARTIAL | refund row record-only; no drawer OUT from processRefund |
| CASH_REVERSED | NOT_FOUND | no payment-reversal transaction |

**Card & gateway** — supported: PENDING/PROCESSING creation (D9), manual verify → COMPLETED; FAILED constant exists. NOT_FOUND: webhook/callback, AUTHORIZED→CAPTURED capture flow, partial capture, void, partial refund, chargebacks (all states), payouts, fees, reserves. Duplicate-event protection: NOT_APPLICABLE (no events arrive). `gateway_code/gateway_reference/auth_code/card_last4` captured on legs; `sys_payment_gateway_cd`/`org_payment_gateway_cf` are config-only → **gateway family: PARTIAL (config + manual verify), integration NOT_FOUND**.

**Check** — CHECK_RECEIVED IMPLEMENTED (check_no/bank/due_date persisted, collect:844); CHECK_DEPOSITED/CLEARED = generic verifyPaymentTx flip (no distinct states); CHECK_BOUNCED/CANCELLED/REPLACED NOT_FOUND → **PARTIAL**.

**Bank transfer** — DECLARED (leg with bank_reference, PENDING) IMPLEMENTED; VERIFIED via verifyPaymentTx; CLEARED/REJECTED/REVERSED NOT_FOUND; no bank clearing account model → **PARTIAL**.

All families: no cash/bank **clearing-account** concept, no GL per event (§39), reconciliation covers link/amount checks only. D9 `default_creation_status='PENDING'` is honored at submit (config beats the CASH/CARD→COMPLETED fallback; explicit request can force PENDING but never COMPLETED) but ignored by `collectPaymentTx` (M6); the only transition out of PENDING is verify — no cancel/fail/bounce, no pending worklist, no durable verification audit (H8).

## 31.1 Pending-payment lifecycle — current vs required (H8 / B30)

`default_creation_status='PENDING'` is the designed contract for non-instant methods (check, bank transfer, gateway-confirmed) — cash normally completes instantly and rarely intersects this lifecycle (M7 is defensive only).

**Current state (verified):**

| Element | Status | Evidence |
|---|---|---|
| Backend transition PENDING→COMPLETED | IMPLEMENTED — locked, idempotent, snapshot recalc, outbox; rejects every other status, so PROCESSING gateway legs (planner:36) have **no completion path at all** | verifyPaymentTx (order-settlement.service.ts:459) |
| API route | IMPLEMENTED — `POST /orders/[id]/payments/[paymentId]/verify`, `orders:verify_payment` | route file |
| UI | PARTIAL — per-payment Verify button on the order Financial tab only | order-payments-credits-tables.tsx:283 |
| Cross-order pending worklist screen | NOT_FOUND | — |
| Cancel / fail / bounce / reject transition | NOT_FOUND — status values exist in the FAILED set (§5.1) but nothing writes them; non-PENDING rows throw on verify | order-settlement.service.ts:515 |
| Reason capture on transition | NOT_FOUND | — |
| Durable actor audit | PARTIAL — row stamps generic `updated_by`/`paid_at` (:528–533); `verified_by` only in the outbox payload, which is never consumed (H6) → no history entry materializes | :549–570 |
| Failure fallback on outstanding policy | NOT_FOUND — plan counted the PENDING leg at full value, so a failed leg leaves outstanding>0 with `outstandingPolicy='NONE'`, no AR/POC reclassification | planner:169–181 |

**Required target state (recommendation — no design or plan yet):**

| Requirement | Content |
|---|---|
| Worklist screen | tenant/branch-scoped list of PENDING/AUTHORIZED legs (method, amount, age, reference, order link) for accountants/back office |
| Actions | VERIFY → COMPLETED; CANCEL → CANCELLED; FAIL/BOUNCE → FAILED (check/bank); each with mandatory reason and per-action permission (`orders:verify_payment` exists; cancel/fail codes missing — §43) |
| Financial consequence | on CANCEL/FAIL: snapshot recalc (statuses already aggregate correctly, §5.1) + outstanding-policy re-evaluation (offer POC / AR / re-tender), drawer/gateway compensation where a movement was recorded |
| Audit | dedicated `verified_by/verified_at` (and cancelled/failed equivalents + reason) on the payment row, or a working outbox→history consumer (B7) — every user action must produce a durable, user-visible log entry |
| Idempotency | replay-safe per transition (verify already is; cancel/fail must be) |

# 32. Split, Partial, Later Collection, and Pay-on-Collection Matrix

| Flow | Planner | BVM | Voucher links | Drawer | Idem | Status filter | Snapshot | Recon | ERP | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Initial full / partial / split | buildSettlementPlan | yes | yes | yes | strong | resolved per D9 | yes | passes | disconnected | IMPLEMENTED |
| Leg pending → verified later | plan + verifyPaymentTx | yes (line status) | yes | yes | replay-safe | PENDING excluded from paid | yes | GATEWAY_PENDING info/warn | disconnected | IMPLEMENTED_WITH_CONSTRAINTS |
| Leg failed | status constant only | — | — | — | — | FAILED excluded | summed separately | — | — | PARTIAL (no transition path) |
| Later partial/full/multiple collections | **collectPaymentTx — NOT the planner** | **none** | **none** | yes | **weak (optional key; unguarded inserts)** | COMPLETED/PENDING only | yes | **ORDER_PAYMENT_LINK blocker** | disconnected | PARTIAL |
| Collection retry | same | — | — | dup risk | weak | — | dup paid risk | — | — | PARTIAL |
| Collection reversal | NOT_FOUND | — | — | — | — | — | — | — | — | NOT_FOUND |
| POC cancellation | §30 | — | — | — | — | — | ok | — | — | IMPLEMENTED |
| POC → AR conversion | NOT_FOUND (payment_type fixed at submit) | — | — | — | — | — | — | — | — | NOT_FOUND |

Verdict: later collection does **not** reuse the canonical planner/BVM; receipt printing for collections uses payment rows, not voucher artifacts.

# 33. Stored-Value Lifecycle Matrix

**Gift cards** (gift-card-service.ts; ledger `org_gift_card_txn_dtl`, balance cols on mst):
created/generated/sold/activated IMPLEMENTED (`sellGiftCard`:314, `adminActivateGiftCard`:395) — SALE ledger txn written, **but no tender/payment fact, BVM voucher, drawer movement, or GL posting (C3)**; redeemed/partially redeemed IMPLEMENTED (`redeemGiftCardTx`:671, keyed, voucher-backlinked); redemption reversed on cancel IMPLEMENTED (restore via cancel unwind) / refundGiftCardTx (:844) for refunds; reloaded NOT_FOUND; suspended/voided/deactivated IMPLEMENTED (:1034–1142); expired: `expireGiftCard(s)` (:1142–1194) — **no scheduler caller → DISCONNECTED**; transferred NOT_FOUND; breakage recognized NOT_FOUND. Liability read-only report (`getTotalGiftCardLiability`:1371); GL events DISCONNECTED. Fraud: PIN bcrypt, admin adjust audit.

**Wallet** (`org_customer_wallets_mst` + `org_wallet_txn_dtl`): auto-create on first top-up; top-up IMPLEMENTED via route/action — TOP_UP ledger txn written, **but no funding tender/payment fact, BVM voucher, drawer movement, or GL posting (C3)**, default `'OMR'`; promotional credit NOT_FOUND (generic top-up only); refund credit IMPLEMENTED (refund WALLET destination); manual adjustment via top-up (no distinct type); order debit IMPLEMENTED (`redeemWalletTx`, FOR UPDATE + keyed); debit reversal on cancel IMPLEMENTED; expiry/transfer/withdrawal NOT_FOUND. Balance = mst column, ledger has before/after; recon checks WALLET_BALANCE vs ledger. GL NOT_FOUND (no wallet ERP event code).

**Customer advance** (`org_customer_advances_mst` + txn): received (`issueAdvanceTx`:190 — funding capture same gap), applied (`redeemAdvanceTx`:245, locked+keyed), application reversed on cancel IMPLEMENTED; refunded/transferred/adjusted NOT_FOUND. GL NOT_FOUND.

**Credit note / customer credit** (`org_credit_notes_mst`): issued IMPLEMENTED (`issueCreditNoteTx`:306, keyed; statuses in CREDIT_NOTE_STATUSES); applied (`redeemCreditNoteTx`:433); unapplied/cancelled/expired/refunded NOT_FOUND; application reversed on cancel → new CN issued (restore path). GL NOT_FOUND.

**Loyalty** (`org_loyalty_txn_dtl`): earned **DISCONNECTED** — `queueEarnPoints` (called on fully-settled orders, settlement:364) only emits a `LOYALTY_EARN` outbox event (loyalty.service.ts:141); `processEarnPoints` has no production caller, so points are never credited (H7, tied to the inactive financial outbox consumer); redeemed IMPLEMENTED (`redeemPointsTx`, stable key); redemption reversed on cancel PARTIAL (manual warning); pending/activated/expired/adjusted/tier NOT_FOUND; liability recognition/release NOT_FOUND. Conversion-rate concern (§7).

Cross-cutting: all redemptions locked+keyed+voucher-backlinked; issuance side lacks money capture; **no stored-value GL liability postings anywhere**; expiry jobs absent.

# 34. Refund, Reversal, Void, and Goodwill Matrix

| Type | Status | Lineage | Cap | Destination executed | Order payable after? | Key gap |
|---|---|---|---|---|---|---|
| REAL_PAYMENT_REFUND | PARTIAL | original_payment_id validated; `refund_source_type` NOT written | per-payment remainder | cash/original = record-only | **No — stays PAID (should reopen or reduce revenue)** | reopen, drawer, gateway, BVM, GL |
| STORED_VALUE_RESTORE | IMPLEMENTED (wallet) / PARTIAL (others via cancel only) | original_credit_app_id in metadata | per-credit remainder | wallet top-up | No (correct — value returned to SV) | source-type col not set |
| PAYMENT_REVERSAL | NOT_FOUND | — | — | — | should reopen due | no transaction type |
| PAYMENT_VOID | NOT_FOUND | — | — | — | should restore due fully | no void flow |
| CREDIT_NOTE_ISSUE | IMPLEMENTED | refund row → CN keyed | refundable balance | CN ledger | No | GL/tax none |
| CUSTOMER_CREDIT_ISSUE | IMPLEMENTED (via overpayment/excess + CN) | disposition rows | excess amount | CN/wallet/advance | n/a | GL none |
| GOODWILL_PAYMENT | NOT_FOUND | — | — | — | — | no goodwill concept (nearest: manual-exception refund) |
| MANUAL_EXCEPTION | IMPLEMENTED_WITH_CONSTRAINTS | lineage forbidden, note required (:167–176) | refundable balance | any | ambiguous — flags REFUND_SOURCE_UNCLASSIFIED | snapshot goes RECALCULATION_REQUIRED |
| CHARGEBACK | NOT_FOUND | — | — | — | — | entire family absent |

Revenue reversal and tax reversal: NOT_FOUND for every type (no negative revenue/tax facts, no ERP dispatch).

# 35. Customer Receipt and Unapplied Cash Lifecycle

| Event | Status | Authority |
|---|---|---|
| Receipt created + posted | IMPLEMENTED | postCustomerAccountReceipt (:39) — voucher-based |
| Allocated / partially allocated across invoices | IMPLEMENTED | customer-receipt-allocation.service + validator + policy |
| Left unapplied / excess retained on account | IMPLEMENTED | excess-executor → WALLET_TOPUP / CUSTOMER_ADVANCE_RECEIPT lines |
| Allocation preview → execute | IMPLEMENTED | customer-receipt-allocation-preview + executeAllocationPreviewTx (keyed) |
| Reallocated / allocation reversed | NOT_FOUND | no unallocation service |
| Receipt refunded / transferred | NOT_FOUND | — |
| B2B statement application | IMPLEMENTED_WITH_CONSTRAINTS | b2b-statement-payment.service (idem 0380); GL DISCONNECTED |
| Customer open balance | IMPLEMENTED | customer-open-balance-query.service ('OMR' default :264) |

GL: all receipt flows DISCONNECTED from ERP-Lite. Order-overpayment allocation (submit/collect) reuses the same executor — consistent.

# 36. Accounts Receivable Lifecycle

| Event | Status | Evidence |
|---|---|---|
| Draft → issued (`issueImmediately`) → posted | IMPLEMENTED | createArInvoiceFromOrders; issue route |
| Payment received + allocated | IMPLEMENTED | allocateArPaymentTx: applied=min(outstanding, allocated); excess→unapplied credit (:598–605) |
| Payment unallocated / reallocated | NOT_FOUND | — |
| Credit note applied / debit note issued | PARTIAL | routes `/ar/invoices/[id]/credit-note|debit-note` exist; GL/tax-doc linkage UNVERIFIED |
| Invoice adjusted / voided | PARTIAL | void route exists; adjustment immutability not enforced (legacy `applyDiscountToInvoice` mutates total directly — UNSAFE_DIRECT_UPDATE) |
| Write-off request/approve/post/reverse | PARTIAL | write-off route + `invoices:write_off` + approve-sensitive route; GL posting NOT_FOUND; reversal NOT_FOUND |
| Aging / overdue | IMPLEMENTED (reporting) | ar-aging UI + AR reports; statement cycles service |
| Dunning | IMPLEMENTED | dunning.service + /b2b/run-dunning-actions route |
| Credit limit | IMPLEMENTED | checkCreditLimit/assertCreditWithinPolicy at submit |
| Expected credit loss / bad-debt recovery | NOT_FOUND | — |
| Period controls | PARTIAL | ERP-Lite periods exist; AR documents not period-gated |

GL: only invoice-created posts (ORDER_INVOICED). Allocations, write-offs, credit/debit notes: DISCONNECTED.

# 37. Revenue Recognition and Contract Liability

**Actual trigger today:** the only revenue-shaped GL entry is the AR-invoice-created journal (ORDER_INVOICED). Cash/POS orders (no AR invoice) produce **no revenue recognition event at any lifecycle point** — not at creation, payment, ready, delivery, collection, or closure.

| Required event | Status |
|---|---|
| SERVICE_REVENUE_RECOGNIZED / REVERSED | NOT_FOUND |
| DEFERRED_REVENUE_CREATED / RELEASED | NOT_FOUND |
| CUSTOMER_ADVANCE_LIABILITY_CREATED | NOT_FOUND (advance ledger exists; no GL) |
| GIFT_CARD_LIABILITY_CREATED | NOT_FOUND (report-only liability read) |
| LOYALTY_LIABILITY_CREATED / RELEASED | NOT_FOUND |

**Layer separation not modeled (target-state requirement, not a regression):**

| Layer | What should record it | Current reality |
|---|---|---|
| Payment received | payment fact + voucher + (target) GL cash/clearing entry | fact + voucher exist; GL absent |
| Receivable created | AR invoice + GL AR/revenue entry | AR invoice + ORDER_INVOICED journal exist (only for CREDIT_INVOICE) |
| Contract liability created | deferred-revenue / advance / GC / loyalty liability postings | ledgers exist; no liability postings |
| Tax liability created | tax facts + tax document + GL VAT-payable entry | tax facts only |
| Revenue earned | recognition event at fulfillment trigger | nothing — cash orders never recognize revenue in GL |

Prepaid orders conflate cash receipt with settlement. IFRS 15 treatment (performance obligation, breakage, points liability): NOT_FOUND.

# 38. BVM Operational Document Catalogue

Constants: `VOUCHER_TYPE` = RECEIPT_VOUCHER, PAYMENT_VOUCHER, REFUND_VOUCHER, ADJUSTMENT_VOUCHER, TRANSFER_VOUCHER (voucher.ts:57); statuses DRAFT/POSTED/CANCELLED/REVERSED/PARTIALLY_REVERSED; GL_POSTING_STATUS reserved for ERP-Lite.

| Document | Status | Runtime use |
|---|---|---|
| RECEIPT_VOUCHER | IMPLEMENTED | submit-order; customer receipts; lifecycle DRAFT→POSTED→wired; 7-day post idempotency; snapshot recalc via recalcOrderSnapshotIfLinked |
| PAYMENT_VOUCHER | PARTIAL | supplier/expense line roles exist; order-side use NOT_FOUND |
| REFUND_VOUCHER | DISCONNECTED | type defined; refund-voucher-service exists; no production caller |
| ADJUSTMENT_VOUCHER | CONFIGURED_ONLY | type + line role only |
| TRANSFER_VOUCHER | CONFIGURED_ONLY | type only (no drawer/safe transfer flow) |
| CUSTOMER_ADVANCE_RECEIPT / CUSTOMER_CREDIT_VOUCHER | PARTIAL | line roles used by receipt-excess executor only |
| REVERSAL_VOUCHER | PARTIAL | reversal via `reversed_line_id` + voucher-reversal.service; **no operational unwind of wired facts** |

Wiring: per-line handlers with partial-wiring status surfaced (`WIRED`/`PARTIALLY_WIRED`); failed wiring rolls back inside submit tx; standalone posts report per-line skip counts. BVM is operational; ERP-Lite owns debit/credit.

# 39. ERP-Lite Accounting Event Matrix

Event codes: ERP_LITE_TXN_EVENT_CODES (erp-lite-posting.ts:69–86). Engine supports preview/execute, BLOCKING/NON_BLOCKING, open-period, idempotency, exceptions, retry/repost.

| Event | Dispatcher | Runtime caller | Status |
|---|---|---|---|
| ORDER_INVOICED (≈AR_INVOICE_POSTED) | yes | ar-invoice.service.ts:1663 | IMPLEMENTED |
| PAYMENT_RECEIVED / ORDER_SETTLED_CASH/CARD/WALLET | yes | **none** | DISCONNECTED |
| REFUND_ISSUED | yes | **none** | DISCONNECTED |
| EXPENSE_RECORDED / PETTY_CASH_TOPUP / PETTY_CASH_SPENT | yes | erp-lite-expenses.service.ts:244 (expense) / :412 (petty cash) | IMPLEMENTED |
| GIFT_CARD_SOLD/REDEEMED/EXPIRED/REFUNDED/VOIDED/BONUS_GRANTED | yes (6) | **none** | DISCONNECTED |
| ORDER_REVENUE_RECOGNIZED | no code | — | NOT_FOUND |
| ORDER_PAYMENT_REVERSED / ORDER_CREDIT_NOTE_ISSUED | no code | — | NOT_FOUND |
| AR_PAYMENT_ALLOCATED / CUSTOMER_ADVANCE_* / WALLET_TOPPED_UP / LOYALTY_* | no code | — | NOT_FOUND (wallet **settlement** is covered by `ORDER_SETTLED_WALLET` above — DISCONNECTED, not NOT_FOUND) |
| CASH_VARIANCE_RECORDED / GATEWAY_FEE / CHARGEBACK / ROUNDING_GAIN_LOSS / FX_GAIN_LOSS | no code | — | NOT_FOUND |

Usage-map/account resolution and expected debit/credit lines come from governance packages (`org_fin_gov_assign_mst` + usage codes; `ERP_LITE_PAYMENT_USAGE_MAP` maps CASH→CASH_MAIN etc., erp-lite-posting.ts:98); exception handling writes `org_fin_post_exc_tr`. Reversal: engine repost/retry exists; journal reversal event NOT_FOUND. BVM↔GL reconciliation: NOT_FOUND.

**Target-state journal sketch for the disconnected/missing events** (recommendation — account resolution stays governance-driven; this fixes only the debit/credit shape):

| Event | Dr | Cr |
|---|---|---|
| ORDER_PAYMENT_RECEIVED (cash/card) | Cash/Clearing (per method usage code) | AR — order / Contract liability |
| ORDER_REVENUE_RECOGNIZED (fulfillment trigger, §37) | Contract liability / AR | Service revenue (+ VAT payable split) |
| ORDER_REFUND_ISSUED (real payment) | Revenue reversal / Refund expense | Cash/Clearing |
| GIFT_CARD_SOLD | Cash/Clearing | GC liability |
| GIFT_CARD_REDEEMED | GC liability | AR — order / revenue |
| GIFT_CARD_EXPIRED (breakage) | GC liability | Breakage income |
| WALLET_TOPPED_UP / ADVANCE_RECEIVED | Cash/Clearing | Wallet/Advance liability |
| WALLET_APPLIED / ADVANCE_APPLIED | Wallet/Advance liability | AR — order |
| LOYALTY_LIABILITY_CREATED / RELEASED | Loyalty expense ↔ Loyalty liability | Loyalty liability ↔ revenue/contra |
| CASH_VARIANCE_RECORDED | Over/short expense (or income) | Cash |
| ROUNDING_GAIN_LOSS / FX_GAIN_LOSS | Rounding/FX loss | Rounding/FX gain |

# 40. Cash, Safe, Bank, and Gateway Controls

| Control | Status | Note |
|---|---|---|
| Drawer open + float / cash sale / change / cash in-out / petty cash | IMPLEMENTED | openSession/recordMovement/wiring handler |
| Cash refund movement | NOT_FOUND | processRefund writes no drawer OUT |
| Safe drop / cash pickup / drawer transfer / drawer-to-safe | NOT_FOUND | TRANSFER_VOUCHER configured-only |
| Cash count / close / variance / force close | IMPLEMENTED_WITH_CONSTRAINTS | expected-cash aggregate unfiltered (:1428) — includes non-COMPLETED/inactive rows |
| Variance approval workflow | NOT_FOUND | variance stored, no approval gate |
| Branch bank deposit | NOT_FOUND | — |
| Gateway clearing / payout / fees | NOT_FOUND | — |
| Bank reconciliation | NOT_FOUND | — |
| Chargebacks | NOT_FOUND | — |

Required invariant (unmet): expected drawer cash must include only active, financially successful cash facts.

# 41. Tax Document and E-Invoice Lifecycle

Services: tax-document-decision, tax-document-sequence, tax-document-write (imports `resolveEInvoiceActivation` from e-invoice.service). **Chain has no production caller** — only a DB test references the writer.

| Item | Status |
|---|---|
| Tax invoice / simplified invoice issuance | DISCONNECTED (service exists; nothing issues) |
| Tax credit note / debit note | NOT_FOUND (order side); AR CN/DN routes exist without tax-doc linkage |
| Cancellation / replacement / submission / acceptance / rejection / resubmission | NOT_FOUND |
| Numbering | IMPLEMENTED in sequence service (unused at runtime) |
| QR generation / branch tax registration / customer tax identity | CONFIGURED_ONLY / PARTIAL (config columns; no runtime issuance) |
| Snapshot lineage + FN-03 mismatch check | IMPLEMENTED but inert — `tax_document_id` never set; lineage nulls (write:924) |
| Tax-period reporting | PARTIAL (financial reports); statutory tax report NOT_FOUND |

# 42. Currency, FX, Precision, and Rounding Lifecycle

| Aspect | Status | Aspect | Status |
|---|---|---|---|
| Currency resolution (tenant/branch/user) | IMPLEMENTED (getCurrencyConfig) | Rate capture (order) | PARTIAL (single `currency_ex_rate`, default 1) |
| Decimal places / minor units | IMPLEMENTED (default 3 hardcoded) | Rate source / history / timestamp / override | NOT_FOUND |
| Rounding increment/mode config | CONFIGURED_ONLY (`sys_currency_rounding_rules_cd`, mig 0290) | Payment vs transaction currency | NOT_FOUND (legs inherit order currency) |
| Cash rounding writer | NOT_FOUND (`rounding_adjustment_amount` unwritten) | Refund currency / original-rate refund | PARTIAL (row currency; no rate logic) |
| Tax rounding | IMPLEMENTED (per-line toFixed dp) | Settlement-rate difference / realized FX G/L | NOT_FOUND |
| Invoice rounding | PARTIAL (legacy invoice math unrounded) | Rounding gain/loss posting | NOT_FOUND |
| Display rounding | IMPLEMENTED (format-money) | Base-currency projection + recon check | IMPLEMENTED |

Hardcoded defaults: consolidated in §15. FX-rounding UI line in payment modal is display-only.

# 43. Financial Permission and Approval Matrix

Confirmed permission codes (lib/constants/permissions/): `orders:create`, `orders:collect_payment`, `orders:verify_payment`, `orders:process_refund`, `orders:approve_refund` (maker-checker enforced in service), `orders:create_adjustment`, `fin_vouchers:reverse`, `invoices:write_off`, `cash_drawer:view`, `reconciliation:run`/`view`; AR sensitive-action route `approve-sensitive`.

| Action | Permission | Maker-checker | Reason required | Threshold | Status |
|---|---|---|---|---|---|
| Refund request/approve/process | yes (two codes) | yes | manual-exception: yes | NOT_FOUND | IMPLEMENTED (controls only) |
| Payment verify / cancel-fail | `orders:verify_payment` / NOT_FOUND | no | no | no | PARTIAL — verify gated; cancel/fail actions absent; actor audit not durable (H8) |
| Order adjustment | yes (+autoApprove flag) | partial | yes | NOT_FOUND | IMPLEMENTED_WITH_CONSTRAINTS |
| Voucher reversal | yes | no | UNVERIFIED | no | PARTIAL |
| AR write-off | yes + approve-sensitive | partial | UNVERIFIED | no | PARTIAL |
| Manual discount / price override | NOT_FOUND (no dedicated code; ride orders:create) | no | no | no | NOT_FOUND |
| Manual charge | NOT_APPLICABLE (no charge flow) | — | — | — | — |
| Cash adjustment / variance approval | NOT_FOUND | no | movement reason: yes | no | PARTIAL |
| Wallet / gift-card adjustment | NOT_FOUND (admin actions unguarded by dedicated code — UNVERIFIED) | no | GC admin-adjust reason: yes | no | PARTIAL |
| Credit issue / CN cancellation | NOT_FOUND (issue keyed but ungated) / NOT_APPLICABLE | — | — | — | PARTIAL |
| Order cancellation / reopen / post-settlement edit | workflow-gated / NOT_FOUND / NOT_FOUND | — | cancel reason: yes | — | PARTIAL |
| Journal reversal / backdated txn / closed-period adjustment / rate override | NOT_FOUND | — | — | — | NOT_FOUND |

Audit fields (`created_by/updated_by/_info`) and outbox audit events are consistent on canonical paths.

# 44. Transaction, Status, and Event Registry Governance

| Registry | Exists | Location | Drift found |
|---|---|---|---|
| PaymentStatus | yes | ORDER_PAYMENT_LIFECYCLE_STATUSES + ORDER_PAYMENT_STATUS (order-financial.ts:464/542) | reconciliation uses literal `'COMPLETED'` (order-checks.ts:159) instead of the set; lowercase-legacy leak check exists |
| RefundStatus | partial | string literals in service ('PENDING_APPROVAL' etc.) | no exported const registry |
| CreditApplicationStatus | yes | CREDIT_APPLICATION_STATUSES | recon credit sum ignores status (:140) |
| VoucherStatus / PostingStatus | yes | VOUCHER_STATUS + GL_POSTING_STATUS | dual vocabularies VOUCHER_TYPE vs VOUCHER_TYPE_LEGACY |
| AccountingEventType | yes | ERP_LITE_TXN_EVENT_CODES | most codes caller-less |
| ReconciliationStatus | yes | RECONCILIATION_* consts | 2 check names unimplemented |
| FinancialBusinessTransactionType | **NOT_FOUND** | — | no unified business-event registry (outbox types partially serve) |
| OrderFinancialMutationType | NOT_FOUND | — | no amendment taxonomy |
| PAYMENT_METHODS | DUPLICATED | constants/order-types.ts **and** constants/payment.ts | different importers (orchestrator vs settlement) |

Recommendation (evidence-backed): unify PAYMENT_METHODS into one module; add exported RefundStatus registry; make reconciliation import the lifecycle sets; introduce a FinancialBusinessTransactionType registry when §28 events are implemented.

# 45. Jobs, Schedulers, and Recovery Processes

| Process | Status | Evidence |
|---|---|---|
| Financial outbox consumption | DISCONNECTED | claimBatch/markProcessed/scheduleRetry exist (outbox.service.ts:57–123); order-history-consumer.service.ts has **no caller**; no processor route; loyalty earning (`LOYALTY_EARN` from queueEarnPoints) is a concrete victim — points are never credited (H7) |
| Notification outbox | IMPLEMENTED | app/api/notifications/process-outbox/route.ts |
| Dunning actions | IMPLEMENTED | app/api/v1/b2b/run-dunning-actions/route.ts |
| Gift-card expiry | DISCONNECTED | expireGiftCards (:1194) — zero callers |
| Wallet / loyalty expiry | NOT_FOUND | — |
| Payment verification sweep / gateway retry | NOT_FOUND | manual verify only |
| ERP posting retry / repost | PARTIAL | engine functions exist; scheduled runner NOT_FOUND |
| Reconciliation schedule | PARTIAL | on-demand routes; no cron |
| Snapshot repair | PARTIAL | RECALCULATION_REQUIRED status + fix-order-data route; no automated sweep |
| Tax-document resubmission / dead-letter processing / AR aging job / ECL / cash-close escalation / idempotency cleanup | NOT_FOUND | TTL columns exist for idempotency; no cleaner |

Net: the platform emits durable financial events and retry metadata that **nothing processes** — the primary operational-recovery gap.

**Required recovery paths (target-state, ordered by dependency):**
1. Scheduled financial-outbox processor (claimBatch → handler registry → markProcessed/scheduleRetry; dead-letter after max attempts) — unblocks order history, loyalty earn (H7), and any future GL-event fan-out.
2. Pending-payment aging sweep — surface PENDING legs older than N days to the §31.1 worklist; escalate unverified checks/transfers.
3. Stored-value expiry runners (gift card exists as `expireGiftCards`; wallet/loyalty need equivalents) + idempotency-key TTL cleaner.
4. ERP posting retry runner over `org_fin_post_exc_tr` + scheduled reconciliation run with drift alerting; snapshot-repair sweep over `RECALCULATION_REQUIRED` rows.

# 46. Reporting and Receipt Consistency

| Output | Source | Status |
|---|---|---|
| Order payment summary / details / receipts (order-invoices-payments, orders-payments-tab, print rprt) | getOrderFinancialSummary / getOrderPaymentsCanonical | IMPLEMENTED (canonical) |
| Voucher receipt print | voucher rows | IMPLEMENTED |
| Cash drawer report / session summary | buildSessionReconciliation | IMPLEMENTED_WITH_CONSTRAINTS (same unfiltered aggregate) |
| Financial reports client | uses `grand_total` naming over canonical fields | PARTIAL — verify field mapping (UNVERIFIED depth) |
| AR statements / aging | AR services | IMPLEMENTED |
| Tax report | NOT_FOUND (statutory) | — |
| GL report | erp-lite-reporting.service | IMPLEMENTED (for the journals that exist) |
| Legacy invoice print math | invoice-service.ts | LEGACY — independent formula |

# 47. Current vs Required Service Gap Matrix

| Required service | Current file/class | Status | Missing responsibilities / action |
|---|---|---|---|
| OrderCalculationService | order-calculation.service.ts | IMPLEMENTED | add TAX_INCLUSIVE + charges; single breakdown adapter |
| OrderRepricingService | — (legacy lib/db/orders.ts) | NOT_FOUND | reprice via canonical engine post-create |
| OrderAmendmentService / OrderFinancialDeltaService | — | NOT_FOUND | §29 model |
| OrderSettlementPlannerService | order-settlement-planner.service.ts | IMPLEMENTED | reuse for later collection |
| OrderSettlementService | order-settlement.service.ts | IMPLEMENTED | retire non-wiring branch |
| LaterCollectionService | collectPaymentTx (embedded) | PARTIAL | BVM + idempotency + planner reuse |
| PaymentLifecycleService / PaymentReversalService | verifyPaymentTx only | PARTIAL / NOT_FOUND | cancel/fail/bounce transitions, cross-order pending worklist screen, mandatory reason + durable verification audit, void/reversal |
| RefundClassificationService | classifyRefunds (snapshot-side) | PARTIAL | write-side classification |
| RefundExecutionService | processRefund | PARTIAL | cash drawer, gateway, BVM, GL, reopen |
| OrderFinancialUnwindService | order-cancel-financials.service.ts | IMPLEMENTED_WITH_CONSTRAINTS | loyalty, tax, GL parity |
| GiftCardService / WalletService / CustomerAdvanceService / CreditNoteService | gift-card-service / stored-value.service | IMPLEMENTED_WITH_CONSTRAINTS | issuance money capture, expiry, GL |
| CustomerCreditService | via CN + disposition | PARTIAL | unify |
| Loyalty redemption service | loyalty.service.ts (`redeemPointsTx`) | IMPLEMENTED_WITH_CONSTRAINTS | conversion-rate config (min_amount reuse) |
| Loyalty earning processor | queueEarnPoints emit-only; processEarnPoints uncalled | DISCONNECTED | schedule outbox consumer (H7/B7) |
| Loyalty expiry/liability services | — | NOT_FOUND | expiry job; liability postings |
| ArInvoiceService / ArAllocationService | ar-invoice.service.ts | IMPLEMENTED | unallocation, period gating, write-off GL |
| CustomerReceiptService | customer-receipt-* suite | IMPLEMENTED | reallocation/reversal |
| CashDrawerService | cash-drawer.service.ts | IMPLEMENTED_WITH_CONSTRAINTS | filtering, safe/bank ops, refund OUT |
| GatewayService / GatewayReconciliationService | config only | NOT_FOUND | callbacks, capture, refunds, payouts, fees |
| BizVoucherService / VoucherWiringService | voucher-* services | IMPLEMENTED | refund voucher activation |
| VoucherReversalService | voucher-reversal.service.ts | PARTIAL | operational unwind |
| AccountingEventDispatcher / AccountingPostingEngine | erp-lite-auto-post / posting-engine | IMPLEMENTED (engine) | connect callers; new event codes |
| TaxDocumentService / EInvoiceService | tax-document-* / e-invoice.service | DISCONNECTED | runtime issuance |
| CurrencyRoundingService / ExchangeRateService | rules table only / — | CONFIGURED_ONLY / NOT_FOUND | rounding writer; rate mgmt |
| FinancialReconciliationService | reconciliation.service.ts | IMPLEMENTED_WITH_CONSTRAINTS | shared aggregation |
| FinancialAuditService | outbox + audit cols + erp-lite-finance-audit.service | PARTIAL | consume events |
| OutboxProcessorService | order-history-consumer (orphan) | DISCONNECTED | schedule it |

# 48. Current vs Required Database Gap Matrix

**EXISTS:** org_orders_mst (45+ canonical fin cols, mig 0333) · org_order_{items,item_pieces,preferences,charges,discounts,taxes,payments,credit_apps,refunds}_dtl · order adjustments ledger · org_fin_vouchers_mst + org_fin_voucher_trx_lines_dtl · org_fin_journal_mst/_dtl · org_fin_{acct,period,usage_map,gov_assign}_mst · org_fin_post_{log,exc,snapshot}_tr · org_fin_overpay_disp_dtl · org_fin_recon_runs_mst (+issues) · org_invoice_mst/_orders_dtl/_payments_dtl · org_customer_wallets_mst + org_wallet_txn_dtl · org_customer_advances_mst (+txn) · org_credit_notes_mst · org_gift_cards_mst (+txn) · org_loyalty_txn_dtl · org_cash_drawer_sessions_mst + org_cash_drawer_movements_dtl · org_b2b_statement_payments_dtl · org_tax_documents_mst · org_tax_{profiles,exemptions}_cf · org_payment_methods_cf + org_branch_payment_methods_cf + org_payment_gateway_cf + sys_payment_gateway_cd · idempotency keys table · outbox events table · org_order_history · sys_currency_rounding_rules_cd · fin-doc number sequences (`fn_next_fin_doc_no`).

**PARTIAL:** org_order_charges_dtl (no writer at submit) · org_tax_documents_mst (no writer) · rounding rules (no consumer) · refund lineage columns `refund_source_type`/`reopens_due_amount` (mig 0340 — read-only in practice).
**LEGACY:** org_invoice_mst direct-math columns (subtotal/discount/total mutated by invoice-service).
**RETIRED:** org_payments_dtl_tr (drop mig 0395).
**DUPLICATED:** none at table level confirmed.
**MISSING (target-state recommendations):** exchange-rate table (+history) · order amendment/delta table · gateway settlement/payout/fee tables · chargeback table · check clearing states table (or status extension) · bank statement/reconciliation tables · safe/bank deposit movement tables · revenue-recognition schedule table · loyalty liability bucket table · stored-value expiry schedule.

# 49. End-to-End Scenario Coverage Matrix

Columns: BVM / Cash / TaxDoc / GL / Snap / Recon; ✓ works, ✗ missing, — n/a. **Status** per §51 vocabulary; **Gap** = blocking item.

| Scenario | BVM | Cash | TaxDoc | GL | Snap | Recon | Tests | Status | Gap |
|---|---|---|---|---|---|---|---|---|---|
| New unpaid order | — | — | ✗ | — | ✓ | ✓ | jest | READY | — |
| Fully paid cash / cash with change | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | jest | READY_WITH_CONSTRAINTS | GL, tax doc |
| Split cash/card, partial payment | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | jest | READY_WITH_CONSTRAINTS | GL |
| Pay on collection → later collection(s) | ✗ | ✓ | ✗ | ✗ | ✓ | **✗ blocker** | partial | PARTIAL | BVM, idempotency |
| AR invoice order | ✓ | — | ✗ | ✓ | ✓ | ✓ | jest | READY_WITH_CONSTRAINTS | tax doc |
| Wallet+card / gift card+cash / advance / CN / loyalty | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | jest (oracle) | READY_WITH_CONSTRAINTS | GL, loyalty rate |
| Loyalty earn after full settlement | — | — | — | ✗ | — | — | none | NOT_READY | outbox consumer (H7/B7) |
| Order increase after payment | ✗ | ✗ | ✗ | ✗ | drift | ✗ | none | NOT_READY | amendment model |
| Order decrease after payment | ✗ | ✗ | ✗ | ✗ | drift | ✗ | none | NOT_READY | delta/refund consequence |
| Cancel unpaid | — | — | — | — | ✓ | ✓ | partial | READY | — |
| Cancel partially/fully paid | ✗ | ✗ | ✗ | ✗ | ✓* | ✗ | partial | PARTIAL | refund gaps, drawer, GL |
| Refund cash / original card | ✗ | ✗ | ✗ | ✗ | wrong due | **✗ permanent blocker** | classify tests only | NOT_READY | C1/C2 |
| Refund to wallet / credit note | ✗ | — | ✗ | ✗ | ✓ | ✗ | partial | PARTIAL | source-type, GL |
| Gateway failure / verification | — | — | — | ✗ | ✓ | info/warn | partial | PARTIAL | callback |
| D9 PENDING method at submit → verify | ✓ | — | ✗ | ✗ | ✓ | warn (MISMATCH) | partial | READY_WITH_CONSTRAINTS | no cancel path, no worklist (H8) |
| D9 PENDING method at later collection | ✗ | ✓ | ✗ | ✗ | wrong paid | ✗ | none | NOT_READY | config ignored (M6) |
| Gateway chargeback | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | none | NOT_IMPLEMENTED | family absent |
| Tax-inclusive order | ✓(snap) | ✓ | ✗ | ✗ | ✓ | ✗ | partial | NOT_READY | preview/submit branch |
| Tax-exempt customer | — | ✓ | ✗ | ✗ | ✓ | ✓ | jest | READY_WITH_CONSTRAINTS | — |
| Order-level charge | ✗ | — | — | — | supported | supported | none | NOT_IMPLEMENTED | no writer |
| Rounding adjustment | — | ✗ | — | ✗ | reads 0 | ✓ | none | NOT_IMPLEMENTED | writer |
| Foreign-currency order | — | — | — | ✗ | base proj ✓ | ✓ | fixture | READY_WITH_CONSTRAINTS | FX G/L |
| Drawer close | — | ✓* | — | ✗ | — | ✓ | partial | READY_WITH_CONSTRAINTS | filtering |
| Voucher reversal | ✓(doc) | ✗ | — | ✗ | ✗ | ✗ | none | PARTIAL | operational unwind |
| Journal reversal / closed-period adjustment | — | — | — | ✗ | — | — | none | NOT_IMPLEMENTED | events absent |
| Tax credit note | — | — | ✗ | ✗ | — | — | none | NOT_IMPLEMENTED | tax docs |
| Duplicate retry (submit) | ✓ | ✓ | — | — | ✓ | ✓ | jest | READY | — |
| Duplicate retry (collect) | ✗ | dup risk | — | — | dup risk | ✗ | none | NOT_READY | idempotency |
| Concurrent payment/refund | lock-ordered | ✓ | — | — | ✓ | ✓ | partial | READY_WITH_CONSTRAINTS | — |

# 50. Consolidated Missing/Pending Backlog

| # | Item | Sev | Class | Evidence | Depends on |
|---|---|---|---|---|---|
| B1 | Write `refund_source_type` + `reopens_due_amount` in refund service | CRITICAL | BLOCKS_PRODUCTION | order-refund.service.ts:311 | Phase-0 reopen rules |
| B2 | Shared aggregation for snapshot + reconciliation (outstanding/credits/status sets) | CRITICAL | BLOCKS_PRODUCTION | order-checks.ts:200 vs write:779 | B1 |
| B3 | GC-sale & wallet-top-up / advance-receipt money capture (payment fact + voucher + drawer) | CRITICAL | BLOCKS_PRODUCTION | gift-card-service.ts:314; wallet top-up route | — |
| B4 | Later collection via planner + BVM voucher | HIGH | BLOCKS_PRODUCTION | order-settlement.service.ts:829 | — |
| B5 | Later-collection required key + per-leg idempotency-skip | HIGH | BLOCKS_PRODUCTION | :640 | B4 |
| B6 | Connect ERP payment/refund/stored-value dispatchers (+ new event codes for wallet/advance/allocation) | HIGH | CONTROL_GAP | §39 | B4 |
| B7 | Financial outbox processor (schedule order-history-consumer; retry/dead-letter live; unblocks loyalty earning — H7) | HIGH | CONTROL_GAP | §45; loyalty.service.ts:141 | — |
| B8 | Gateway callback/capture/refund integration | HIGH | BLOCKS_FEATURE | §31 | — |
| B9 | Refund execution: drawer OUT movement + REFUND_VOUCHER activation | HIGH | CONTROL_GAP | §8 | B1 |
| B10 | Payment reversal / void transaction types | HIGH | BLOCKS_FEATURE | §34 | Phase-0 |
| B11 | Canonical tax-inclusive branch in calculateOrderTotals + item-edit alignment | HIGH | BLOCKS_FEATURE | §14 | — |
| B12 | Order amendment service + delta model + immutable record; retire lib/db/orders recalc | HIGH | BLOCKS_FEATURE / MAINTENANCE_RISK | §29 | Phase-0 |
| B13 | Voucher reversal → operational unwind (payments, credits, drawer, snapshot) | HIGH | CONTROL_GAP | voucher-reversal.service.ts | B10 |
| B14 | Tax-document writer runtime connection + credit/debit notes | HIGH | BLOCKS_FEATURE | §41 | — |
| B15 | Remove 'OMR'/'USD'/0.05/0.06 defaults; unify tolerances | MEDIUM | CONTROL_GAP | §15 | — |
| B16 | Drawer close filtering (COMPLETED + is_active) + variance approval | MEDIUM | CONTROL_GAP | cash-drawer.service.ts:1428 | — |
| B17 | Rounding writer + consume sys_currency_rounding_rules_cd | MEDIUM | BLOCKS_FEATURE | §15 | — |
| B18 | Order-charge write path at submit | MEDIUM | BLOCKS_FEATURE | orchestrator:989 | — |
| B19 | Gift-card/wallet/loyalty expiry jobs; idempotency cleanup | MEDIUM | CONTROL_GAP | §45 | B7 |
| B20 | Implement TAX_CALCULATION / DISCOUNT_VALIDATION recon checks (or drop constants) | MEDIUM | CONTROL_GAP | recon:66 | B2 |
| B21 | Loyalty conversion-rate config (stop reusing min_amount) | MEDIUM | MAINTENANCE_RISK | settlement:317 | — |
| B22 | Consolidate PAYMENT_METHODS + RefundStatus registries; recon imports status sets | MEDIUM | MAINTENANCE_RISK | §44 | — |
| B23 | Retire legacy invoice-service math + non-wiring settle branch + duplicate routes | MEDIUM | MAINTENANCE_RISK | §18 | — |
| B24 | AR unallocation/reallocation; write-off GL; period gating | MEDIUM | BLOCKS_FEATURE | §36 | B6 |
| B25 | Revenue recognition / contract-liability events (IFRS 15) | LOW→HIGH at GA | FUTURE_ENTERPRISE | §37 | B6 |
| B26 | FX rate management + realized G/L; chargebacks; gateway payouts/fees; bank reconciliation; safe/deposit ops; ECL | LOW | FUTURE_ENTERPRISE | §31/§40/§42 | — |
| B27 | Missing permissions: price override, manual-discount threshold, cash variance approval, SV adjustments, closed-period, rate override | MEDIUM | CONTROL_GAP | §43 | — |
| B28 | Test coverage for §49 NOT_READY rows (refund-outstanding, collect retry, amendments) | HIGH | CONTROL_GAP | §49 | B1–B5 |
| B29 | Stale docs: reports claiming refund lineage "Phase 6 backfilled" — runtime never writes it | LOW | MAINTENANCE_RISK | mig 0340 vs service | — |
| B30 | Pending-payment lifecycle workstation: cross-order pending worklist screen + verify/cancel/fail/bounce actions with mandatory reason, durable actor audit (verified_by/cancelled_by columns or working history consumer), outstanding-policy fallback when a PENDING leg fails, and a completion path for PROCESSING gateway legs (verify currently accepts PENDING only) | HIGH | BLOCKS_FEATURE / CONTROL_GAP | H8; order-settlement.service.ts:515–533 | B7 only for outbox-based durable history; the pending-payment worklist and lifecycle transitions are independent |
| B31 | `collectPaymentTx` must read and honor `default_creation_status` (and per-leg explicit status) instead of hardcoding COMPLETED for non-gateway methods | MEDIUM | CONTROL_GAP | M6; order-settlement.service.ts:827 | B4 |
| B32 | Gate drawer movements on effective payment status; implement or remove `allow_status_override` | LOW | CONTROL_GAP | M7/M8 | — |
| B33 | Correct pending-payment warning semantics so a valid PENDING leg does not emit `PENDING_PAYMENT_COUNTED_AS_PAID` or force MISMATCH unless the pending amount was actually included in paid totals | MEDIUM | CONTROL_GAP | §5.2 / M9 | B2 |
| B34 | Refund back-office UI: initiate-refund screen (payment/credit-leg picker from order detail), approval queue, process action — the maker-checker workflow is API-complete but UI-absent (Addendum A1) | HIGH | BLOCKS_FEATURE / CONTROL_GAP | A1 | B1 (classification display); B27 (impl) |

# 51. Final Readiness Verdict

| Domain | Verdict |
|---|---|
| Initial tax-exclusive checkout | READY_WITH_CONSTRAINTS |
| Tax-inclusive checkout | NOT_READY |
| Later collection | PARTIAL |
| Stored value (application at settlement) | READY_WITH_CONSTRAINTS |
| Stored value (issuance/expiry/liability, loyalty earn) | PARTIAL |
| Refunds | NOT_READY |
| Cancellation | PARTIAL |
| Order amendments | NOT_READY |
| AR | READY_WITH_CONSTRAINTS |
| Cash drawer | READY_WITH_CONSTRAINTS |
| BVM (initial submit) | READY |
| BVM (refund/reversal/collection parity) | PARTIAL |
| ERP/GL order-to-cash | NOT_READY |
| Tax documents / e-invoice | NOT_IMPLEMENTED (runtime) |
| Currency/FX/rounding | PARTIAL |
| Reconciliation | PARTIAL |
| Reporting/receipts | READY_WITH_CONSTRAINTS |
| **End-to-end order-to-cash** | **NOT_READY** |

---

# Addenda (post-freeze, code-verified)

## A1 — Refund workflow is UI-absent (verified 2026-07-16)

The refund maker-checker workflow (§8) is **API-complete but has no usable UI**: no screen can initiate, approve, or process a standalone refund.

| Layer | Surface | Verified state |
|---|---|---|
| Service + API | initiate/approve/process routes (`/orders/[id]/refund(s)`, `/orders/refunds/[refundId]/approve\|process`), permission-gated | IMPLEMENTED (controls only, per §8) |
| Server action | `initiateOrderRefund` (app/actions/billing/refund-actions.ts:123) | **zero UI callers** |
| Refunds page | `/dashboard/internal_fin/refunds` → refunds-list-client.tsx | **read-only list** — no initiate/approve/process actions |
| Order detail | order-detail-client.tsx | refund appears only as an edit-history label |
| Only creating path | cancel-order-dialog REFUND disposition → cancel unwind creates refund rows programmatically | refunds possible **only** via full order cancellation |

Consequence: refunds on live orders (wrong item, partial complaint, goodwill) and the approval/processing of PENDING_APPROVAL rows are impossible without direct API calls. Classification for §43's refund permissions is unchanged (codes exist; no UI consumes them). New backlog item **B34** (refund back-office UI) added to §50. This also sets the general completeness rule for remediation: a capability with backend but no usable screen is PARTIAL, never complete.

```text
AUTHORITATIVE REPORT STATUS:
COMPLETE WITHIN THE INSPECTED WEB-ADMIN SCOPE,
EXCEPT FOR THE EXPLICITLY LISTED UNVERIFIED AREAS

UNVERIFIED AREAS:
- GL/tax-document depth of AR credit-note, debit-note, and write-off route handlers (routes exist; posting effects not traced line-by-line)
- Permission gating on gift-card/wallet admin adjustment server actions (dedicated codes not found; action-level guards not fully traced)
- financial-reports-client.tsx field mapping depth (grand_total naming vs canonical columns)
- ERP-Lite retry/repost invocation from any finance-exceptions UI
- cmx-api (NestJS) — out of scope this pass; no financial writers found from web-admin references

SUPERSEDES:
previous consolidated report version (2026-07-15 v1, single-verdict edition)
and the 2026-07-11 / 2026-07-15 source reports
```
