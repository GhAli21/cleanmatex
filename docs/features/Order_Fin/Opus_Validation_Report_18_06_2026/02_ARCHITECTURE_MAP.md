# 02 — Architecture Map (as discovered in code)

This is the **actual** architecture read from the repo, not the intended one.

## Order financial
- **Single canonical recalc:** `recalculateOrderFinancialSnapshotTx(tx, tenantId, orderId)` ([order-financial-write.service.ts](../../../web-admin/lib/services/order-financial-write.service.ts)) is the **only** place the header snapshot is computed; reused by submit, collect, refund, allocation (each calls it at the end of its TX). Writes ~40 canonical columns on `org_orders_mst` + a JSON `financial_calculation_snapshot` (v5) + hash + trace id.
- **Money layers kept distinct:** `total_amount` (full sale value), `total_paid_amount` (COMPLETED/CAPTURED/SETTLED real payments only), `total_credit_applied_amount` (APPLIED credits only), `outstanding_amount`, `overpaid_amount` (unresolved excess only), `pay_on_collection_amount`, `ar_receivable_amount`, base-currency mirrors.

## Payment
- **Planner → legs:** `order-settlement-planner.service` builds a `SettlementPlan` (real-payment legs + credit-application legs). Real legs resolve a payment status (`resolvePaymentStatus`): cash/card/mobile → COMPLETED; bank/check/gateway → PENDING.
- **Effect table:** `org_order_payments_dtl` — **ORDER real payments only** (`payment_target_type` deliberately dropped, `0337`). `payment_nature_snapshot='REAL_PAYMENT'`.

## Credit / stored value
- `stored-value.service`: wallet (`org_wallet_txn_dtl`), advance (`org_advance_txn_dtl`), credit note (`org_credit_note_txn_dtl`) — issue/redeem; **never** writes `org_order_payments_dtl`.
- Order credits recorded as `ORDER_CREDIT_APPLICATION` voucher lines + `org_order_credit_apps_dtl` rows (lifecycle: only APPLIED reduces outstanding).

## Voucher / BVM
- **Header/lines:** `org_fin_vouchers_mst` + `org_fin_voucher_trx_lines_dtl` (universal line: `line_role`, `target_type`, `target_id`, direction, amounts, idempotency, wiring back-links).
- **Post + wire:** `createBizVoucher` → `addVoucherLine` (per leg) → `postAndWireBizVoucher`. A **handler registry** dispatches per line: `order-payment` → `org_order_payments_dtl`; `invoice-payment` → AR allocate; `statement-payment` → B2B statement; `cash-drawer` → drawer movements. Wiring back-links (`order_payment_id`, `cash_drawer_mvt_id`) populated post-post.
- **Catalogs:** `sys_fin_vch_line_role_cd`, `_target_type_cd`, `_source_type_cd`, `_line_type_cd`, `_direction_cd` (abbreviated `vch`); overpay/receipt catalogs in `sys_fin_overpay_res_cd`, `sys_fin_rcpt_*`, `sys_fin_rem_bal_policy_cd`.

## AR invoice
- `ar-invoice.service` — substantial module: `createArInvoiceFromOrders`, `allocateArPaymentTx`, reverse, adjustments, AR ledger movements, customer balance/aging/statement, **outbox events** (`emitEventTx`), ERP-Lite auto-post. **Idempotency via central `org_idempotency_keys`** (`withIdempotency`), not effect-table index.
- Effect rows in `org_invoice_payments_dtl` (allocation_no per invoice).

## B2B statement
- `b2b-statement-payment.service.allocateB2bStatementPaymentTx` — `FOR UPDATE` on `org_b2b_statements_mst`, caps to balance, updates paid/balance/status in place. **No detail table, no idempotency** (F-02/F-04). Open-balance query includes statements via raw SQL.

## Cash drawer
- `cash-drawer-wiring.handler` (runs after order-payment handler): CASH_SALE IN movement uses settled `line.amount`; CASH_OUT for change. Sessions in `org_cash_drawer_sessions_mst`, movements in `org_cash_drawer_movements_dtl`. Session open/close + reconciliation **not inspected** (❓).

## Overpayment / allocation
- **Validator** (`overpayment-resolution-validator.service`) blocks unresolved excess (catalog-driven, cash-only change capacity, allocation-preview validation).
- **Disposition** (`overpayment-disposition.service`) executes wallet/advance/credit inside the submit/collect TX; audit rows in `org_fin_overpay_disp_dtl` (now FK-bound to `sys_fin_overpay_res_cd`, `0378`).
- **Customer receipt allocation:** policy (`org_fin_rcpt_alloc_policy_cf`) → open-balance query (AR-invoice-wins) → preview (`org_fin_rcpt_alloc_preview_tr`, idempotent) → confirm/post → voucher lines per target. Manual + auto (oldest-due) modes.

## Tax document
- `org_tax_documents_mst` (+ lines) (`0341`), `tax-document-sequence.service` (gap-free `FOR UPDATE` numbering on `org_tax_doc_seq_counters` — **RLS gap, F-01**). Tax-category decomposition + fiscal-total reconciliation **stubbed** (F-05). Tax documents are separate from AR invoices (rule 24/25 ✅).

## Frontend
- Next.js App Router; Cmx design system. Payment Modal **V4** + `extra-receipt-handling-card` (overpayment routing), allocation drawers (auto/manual), order-details financial view. Canonical labels in `messages/en.json` (EN/AR parity ✅). RBAC-gated action buttons; **no feature-flag gating** (F-03).

## Testing
- Jest + ts-jest (jsdom); service tests **mock the Prisma `tx`**; `__tests__/db` tests the client wrapper, not real data. **No DB-truth (CHECK/FK/RLS) tests** (F-T5). Two idempotency mechanisms in code (effect-table indexes + `org_idempotency_keys`).

## Cross-cutting
- **Idempotency:** route-level (submit-order stake/heal) + effect-table partial unique indexes + central `org_idempotency_keys` (AR). **B2B is the one path with none.**
- **Transactions:** submit + collect each wrap all writes (order/voucher/legs/stored-value/disposition/allocation/settle/recalc) in one `prisma.$transaction`.
- **Outbox/events:** AR uses `emitEventTx`; order submit emits `order.created` notification.
