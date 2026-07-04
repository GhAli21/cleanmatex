# ADR-055 — Single Payment Read Model

**Status:** Accepted
**Area:** Order Financial Platform / Reporting & Display
**Date:** 2026-07-04
**Source:** Order-Fin validation 2026-07-03 finding FN-01 + Remediation
(`docs/features/Order_Fin/Order_Fin_Remediation_2026-07/PLAN.md`), completing
[ADR-002](./ADR-002-Deprecate-org-payments-dtl-tr.md).

## Context

Between 2026-05-30 (ADR-002) and this program, the platform had a split-ledger
seam: the canonical write path stored order payments in
`org_order_payments_dtl` (+ voucher trx lines), while a set of display/report
surfaces still read the legacy `org_payments_dtl_tr` ledger the write path had
abandoned — so the Payments tab, order payment prints, tenant Payments report,
and cash-up silently showed nothing/stale data ("the report doesn't match the
order screen" class of defects).

## Decision

1. **One read path per money question.** Every UI, report, print, or export
   that lists payments MUST read the canonical ledgers:
   - Order payments → `org_order_payments_dtl` via
     `getOrderPaymentsCanonical()` / `getOrderFinancialSummary()`
     (`lib/services/order-financial-summary.service.ts`).
   - Invoice collections → `org_invoice_payments_dtl` (AR allocations,
     voucher-referenced) + AR ledger.
   - On-account money → customer receipts + stored-value ledgers
     (wallet / advance / credit notes).
   - Cash position → cash drawer sessions/movements + the D-09 reconciliation
     reports (the legacy cash-up module was retired).
2. **The legacy ledger is gone.** `org_payments_dtl_tr`,
   `org_payment_audit_log`, and `org_invoice_payments_dtl.payment_id` were
   dropped by migration `0395` (empty-table guards, RESTRICT-only). AR
   allocations reference their money source by **voucher id only**.
3. **No new payment display source may be introduced** without extending the
   canonical read model — a new "payments list" that queries anything else is
   an architecture violation, not a shortcut.
4. **Historical presentation:** there was no historical data (the ledger was
   verified empty on drop), so no legacy-row display rules are needed.

## Consequences

- The output-consistency matrix (validation report 06) is canonical-only —
  every surface agrees with the snapshot engine by construction, and the
  `payments-report-canonical` / `order-payments-canonical-read` test suites
  lock the seam.
- `lib/types/payment.ts` no longer carries transaction shapes for the legacy
  ledger (`PaymentTransaction`, `ProcessPayment*`, `PaymentList*`, `CashUp*`,
  lowercase `PAYMENT_STATUSES`) — canonical display types live with the read
  model (`OrderPaymentRow`).
- Prisma no longer has models for the dropped tables; the stale
  cash-drawer-movement relation was repointed to the canonical table it
  actually FKs to (`fk_org_cdm_order_payment`, 0271).
