# 04 — What Is Implemented (evidence-backed)

Only features with **first-hand evidence** are listed as implemented. Each: how it works · files/tables · business behavior · known risks.

> **STALE-CLAIM CORRECTION (B29 doc sweep, 2026-07-19):** the "Refunds — ✅ (structure)" entry below claims `refund_source_type` classification as implemented/verified. The frozen [Authoritative Report §13/§21](../../../Audit_Reports/CleanMateX_Enterprise_Financial_Accounting_Audit_15_07_2026/CleanMateX_Order_Payment_Authoritative_Current_Implementation_Report_2026-07-15.md) (2026-07-15) found the refund service never actually wrote that column — this validation pass (2026-06-18) verified `classifyRefunds`'s in-memory heuristic, not that its output reached the DB column, which only started with [B01](../Remediation_Work_Packages/B01_Refund_Lineage_And_Reopen_Due.md) on 2026-07-18. Other entries in this file are unaffected.

### Order financial snapshot — ✅
- **How:** one recalc (`recalculateOrderFinancialSnapshotTx`) reads fact rows (items/charges/discounts/taxes/payments/credits/refunds/invoice link/disposition sum) and writes canonical totals + JSON snapshot v5 + hash + trace.
- **Tables/files:** `org_orders_mst`, `order-financial-write.service.ts`.
- **Behavior:** correct paid/credit/pending/overpaid math; warnings for mismatches; status (CURRENT/MISMATCH/RECALCULATION_REQUIRED).
- **Risks:** tax-base decomposition stubbed (F-05).

### Order submit — ✅
- **How:** thin route → `submitOrder` orchestrator; one TX; route owns idempotency (stake/heal/unstake, payload-hash conflict).
- **Files:** `submit-order/route.ts`, `order-submit-orchestrator.service.ts`.
- **Behavior:** validates totals/credit/overpayment, posts voucher + legs + stored-value + disposition + allocation + settlement atomically.
- **Risks:** none material; stale "tx1" comment (cosmetic).

### Payment legs / real payments — ✅
- `org_order_payments_dtl` (ORDER-only), `nature=REAL_PAYMENT`; gateway/bank/check → PENDING; cash/card/mobile → COMPLETED. Idempotency: `uq_org_ord_pay_dtl_idempotency` + `uq_ord_pay_vch_line`.

### Credit applications: gift card / wallet / advance / customer credit — ✅
- `ORDER_CREDIT_APPLICATION` voucher lines + `org_order_credit_apps_dtl` (lifecycle status; only APPLIED reduces outstanding); stored-value ledgers (`org_wallet_txn_dtl`, `org_advance_txn_dtl`, `org_credit_note_txn_dtl`) each with idempotency + per-line unique indexes. **Never** writes payment rows.

### BVM voucher posting + wiring — ✅
- `org_fin_vouchers_mst` + `org_fin_voucher_trx_lines_dtl`; handler registry (order/invoice/statement/cash). Idempotency: `uq_vch_trx_line_idempotency` + `uq_vch_trx_ln_voucher_line_no`. Back-links populated post-post.

### Cash drawer — ✅ (one low gap)
- `cash-drawer-wiring.handler`: CASH_SALE (settled amount) + CASH_OUT (change). `org_cash_drawer_sessions_mst`/`_movements_dtl`. Risk: CASH_OUT change row lacks idempotency index (F-07). Session close/Z-report **not verified**.

### Overpayment / extra receipt / disposition — ✅
- Validator blocks unresolved excess; disposition routes change/reduce/wallet/advance/credit inside the TX; audit `org_fin_overpay_disp_dtl` (FK to catalog, `0378`). `overpaid_amount` = unresolved only.

### Customer receipt allocation (manual + auto-oldest) — ✅
- Policy `org_fin_rcpt_alloc_policy_cf`; open-balance query (AR-invoice-wins); preview `org_fin_rcpt_alloc_preview_tr` (idempotent); post via voucher lines. Services: `customer-receipt-allocation*`, `customer-open-balance-query`.

### AR invoice — ✅
- `ar-invoice.service`: create-from-orders, allocate (idempotent via `org_idempotency_keys`), reverse, adjustments, AR ledger, balance/aging/statement, outbox events, ERP-Lite auto-post. Effect: `org_invoice_payments_dtl`. Reverse/ledger depth **not fully verified**.

### B2B statement payment — 🟡
- `allocateB2bStatementPaymentTx`: FOR UPDATE + cap + status update in place. **Gaps:** no idempotency (F-02), no detail table (F-04).

### Pay on collection — ✅
- `payOnCollectionAmount` computed separately from `ar_receivable_amount` (rule 26).

### Refunds — ✅ (structure)
- `order-refund.service`: over-refund prevention, voucher links, `refund_source_type` classification, recalc. Create idempotency **not verified**.

### Tax documents — 🟡
- `org_tax_documents_mst` (+lines), gap-free sequence service. Stubs: category decomposition + fiscal-total reconciliation (F-05). RLS gap on seq counters (F-01).

### APIs — ✅ (flag gap)
- Versioned `/api/v1/...`; Zod validation; permission checks; submit-order idempotency lifecycle. **No feature-flag gating** (F-03).

### Frontend — ✅
- Payment Modal V4 + extra-receipt card + allocation drawers; Cmx components; canonical labels; EN/AR parity (✅ check passed); RBAC-gated. No flag-driven UI gating (F-03/UX-01).

### Permissions — ✅
- Seeded + enforced (`requirePermission` / `requireAnyPermission`); `resource:action` format.

### Idempotency infrastructure — ✅
- Two mechanisms: effect-table partial unique indexes; central `org_idempotency_keys` (RLS, unique). Robust submit-order lifecycle.
