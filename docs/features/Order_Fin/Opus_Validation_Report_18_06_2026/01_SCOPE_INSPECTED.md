# 01 — Scope Inspected

Source of truth: **codebase + live local DB** (`supabase_local` MCP, read-only). Docs/ADRs/plans/prior reports = references. Two passes: initial forensic sweep + a deep-dive re-verify of ❓ items ([22](./22_FOLLOWUP_DEEP_DIVE.md)).

## Migrations inspected (read or DB-introspected)
`0301` (voucher lines), `0337` (payment target drop + credit lifecycle), `0354` / `0360` / `0368` / `0378` (overpay disposition + FK fix), `0357` (settlement catalogs). DB-level introspection of constraints/indexes/RLS for the full finance schema (`0300`–`0378`). `0376`/`0377` (feature-flag seeds) referenced.

## Database tables inspected (live)
- **RLS + policy sweep:** 78 finance tables (`org_fin_*`, `org_order_pay*`, `org_order_credit*`, `org_invoice*`, `org_b2b*`, cash drawer, wallet/gift/advance/credit-note, `org_*overpay*`, `org_*rcpt*`, `org_tax_doc*`, `org_*refund*`).
- **Idempotency/unique index sweep:** `org_order_payments_dtl`, `org_fin_voucher_trx_lines_dtl`, `org_invoice_payments_dtl`, `org_cash_drawer_movements_dtl`, `org_fin_overpay_disp_dtl`, `org_fin_rcpt_alloc_preview_tr`, `org_wallet_txn_dtl`, `org_advance_txn_dtl`, `org_credit_note_txn_dtl`, `org_idempotency_keys`.
- **Constraints:** `org_fin_overpay_disp_dtl` (FK + checks), `sys_fin_overpay_res_cd` (PK), `org_invoice_payments_dtl` (uniques).
- **Columns:** `org_tax_doc_seq_counters`; catalog completeness of `sys_fin_overpay_res_cd` (9 rows).

## Backend services inspected (first-hand)
`order-financial-write.service` (full recalc), `order-submit-orchestrator.service` (TX window), `overpayment-resolution-validator.service`, `overpayment-disposition.service`, wiring handlers (`order-payment`, `invoice-payment`, `statement-payment`, `cash-drawer`), `customer-open-balance-query.service`, `b2b-statement-payment.service`, `ar-invoice.service` (header + `withIdempotency` + `allocateArPaymentTx` signature), `tax-document-sequence.service`, `stored-value.service` (isolation grep), `order-settlement.service` (`collectPaymentTx` signal grep), `order-refund.service` (structure grep).

## API routes inspected
`POST /orders/submit-order` (full), `POST /orders/[id]/collect-payment` (full), `POST /customer-receipts/allocation/post` (full). Inventory + permission/flag grep across all `app/api/v1` finance routes.

## Frontend inspected
`extra-receipt-handling-card.tsx` (full), payment-modal V4 family inventory, summary-card labels in `messages/en.json`, i18n parity script run.

## Constants/Zod inspected
`settlement-catalog.ts`, `voucher.ts` (LINE_ROLE/TARGET_TYPE/requirements), `order-financial.ts` (lifecycle/credit statuses), `customer-receipt-allocation` types/validations.

## Tests inspected
`settlement-catalog.test.ts` (rewritten this session), `overpayment-disposition.wallet.test.ts` (added), `overpayment-resolution-validator.service.test.ts`, `order-financial-classify-refunds.test.ts`, `order-financial-warning-codes.test.ts`, `order-payment-wiring.handler.test.ts`; full finance test inventory; jest config + setup (mock-Prisma pattern).

## Docs/ADRs inspected
`Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md`, `ADR-047`, `ADR-046`, prior `Order_Financial_Validation_Report_2026-06-18.md`, BVM/AR/tax ADR set (spot-checked).

## Commands / searches used
`Glob` (finance services, migrations, routes, components); `Grep` (risk markers, feature-flag literals, financial table usage, idempotency/constraint terms); `supabase_local` MCP read-only SQL (RLS, indexes, constraints, columns, catalog rows, orphan previews); `node scripts/check-i18n-parity.js`; first-hand `Read` of the files above; `npx jest` + `tsc` + `eslint` for the changed test/migration validation.

## Explicitly NOT inspected (still ❓ — see [22 §Still not verified](./22_FOLLOWUP_DEEP_DIVE.md))
Refund-create idempotency body; AR reverse-allocation + `voucher-reversal.service` accounting; cash-drawer session open/close + Z-report reconciliation; `promotion-engine.service` + `loyalty.service` correctness; gateway capture/callback lifecycle; allocation drawer components; mobile/offline POS.
