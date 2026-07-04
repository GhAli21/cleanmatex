# Deprecate org_payments_dtl_tr

**Status:** ✅ Implemented / REMOVED (completed 2026-07-04, Order-Fin remediation Phase 5)
**Area:** Business Voucher / Payment Architecture  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

`org_payments_dtl_tr` is too narrow for CleanMateX finance needs and cannot cover outgoing payments, petty cash, source-document lineage, credit application effects, AR invoice payments, refunds, and voucher posting.

## Decision

Block/deprecate `org_payments_dtl_tr` for new development. `org_fin_voucher_trx_lines_dtl` becomes the canonical transaction-line table.

## Consequences / Implementation Rule

If historical rows exist, migrate them or keep them read-only. No new writes should target `org_payments_dtl_tr`. (the table is empty now)

## Completion (2026-07-04)

The deprecation was completed end-to-end by the Order-Fin remediation program
(`docs/features/Order_Fin/Order_Fin_Remediation_2026-07/PLAN.md`):

- **Phases 1–2:** every read surface (order Payments tab, order payment prints,
  tenant Payments report, ready-page payment context, voucher payment linkage)
  repointed to the canonical ledgers.
- **Phase 3:** every write path (record deposit/POS, apply-to-invoice, record
  advance, `processPayment`/`recordPaymentTransaction`) removed; the
  `internal_fin/payments` screens retired (nav migration `0393`).
- **Phase 5:** the table was verified empty and **DROPPED** together with its
  audit satellite `org_payment_audit_log` and the orphaned AR reference column
  `org_invoice_payments_dtl.payment_id` — migration
  `0395_drop_org_payments_dtl_tr.sql` (guarded, RESTRICT-only). The legacy
  cash-up module was retired in the same phase (nav migration `0394`).
- The successor read model is codified in
  [ADR-055 — Single Payment Read Model](./ADR-055-Single-Payment-Read-Model.md).
