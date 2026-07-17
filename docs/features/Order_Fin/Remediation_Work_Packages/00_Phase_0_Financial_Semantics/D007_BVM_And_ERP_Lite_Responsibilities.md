# D007 — BVM and ERP-Lite Responsibilities

## Metadata
Decision ID: D007 · Status: PROPOSED · Approved decision: NOT YET APPROVED · Decision type: Layer-boundary policy
Authoritative report sections: §11, §12, §38, §39, layer rule (report header)
Blocks: B6, B13, B14 · Affects: B3, B4, B9, B25
Owner: — · Approval date: — · Supersedes: —

## Problem
The layer rule is stated in the report but not frozen as policy: which transaction families require a BVM operational voucher, an ERP-Lite journal, both, or neither. Without it, B3/B6/B9 could wire money paths inconsistently (e.g. refund voucher without journal, or journal without voucher).

## Frozen separation (invariant)

```text
Business event ≠ BVM operational voucher ≠ operational payment/credit fact
≠ cash-drawer movement ≠ ERP-Lite journal
```

BVM owns operational voucher governance and wiring; ERP-Lite owns debit/credit accounting. No service may describe BVM as the ledger; `posting_status`/GL fields on vouchers belong to ERP-Lite alone.

## Proposed family matrix (finalize on approval)

| Family | BVM voucher | ERP journal | Notes |
|---|---|---|---|
| Order settlement (all tenders) | required (exists) | required (B6) | current: voucher yes / GL no |
| Later collection | required (B4) | required (B6) | current: neither |
| Refund execution | required (B9, REFUND_VOUCHER) | required (B6) | current: neither |
| Stored-value funding (GC sale, top-up, advance) | required (B3) | required (liability, B6/B25) | current: ledger only |
| Stored-value redemption | voucher line (exists) | required (B6) | |
| Payment reversal / void | reversal voucher w/ unwind (B13) / line status only | reversal journal / none | per D004 |
| Overpayment disposition | linked to settlement voucher (exists) | via settlement events | |
| Cash movements (float, in/out, petty) | none (drawer facts) | petty-cash journal (exists); variance journal (target) | |
| AR invoice / allocation / write-off | none / receipt voucher / none | exists / required / required | B24 |
| Tax documents | none (fiscal doc layer) | via revenue/tax events | B14 |

## Decision scope
Confirm the matrix; define failure coupling (voucher posts but journal fails → NON_BLOCKING exception vs rollback, per event); BVM↔GL reconciliation ownership (B20/B6).

## Related decisions / affected packages
[D008](D008_Stored_Value_Funding_Treatment.md), [D012](D012_Revenue_Recognition_Policy.md), [D004](D004_Refund_Vs_Reversal_Vs_Void.md) → [B03](../B03_Stored_Value_Funding_Capture.md), [B04](../B04_Later_Collection_BVM_Parity.md), [B06](../B06_ERP_Order_To_Cash_Event_Wiring.md), [B09](../B09_Refund_Execution_Parity.md), [B13](../B13_Voucher_Reversal_Operational_Unwind.md), [B14](../B14_Tax_Document_Runtime_Integration.md), [B25](../B25_Revenue_Recognition_And_Contract_Liability.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| — | — | — | — | — |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Skeleton | Claude |
