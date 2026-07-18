# D007 — BVM and ERP-Lite Responsibilities

## Metadata
Decision ID: D007 · Status: APPROVED (Expert)
Approval status: APPROVED
Approval type: Expert
Selected option: Frozen five-layer boundary + approved responsibility matrix + outbox failure-coupling model
Approved decision: financial fact tables = operational source facts; BVM = governed business voucher/document layer; ERP-Lite = accounting journals/ledgers/posting; Cash Drawer = physical cash custody and reconciliation; Tax Document = fiscal/legal document. Responsibility matrix and failure coupling per the binding section below
Decision type: Layer-boundary policy
Authoritative report sections: §11, §12, §38, §39, layer rule (report header)
Blocks: B6, B13, B14 · Affects: B3, B4, B9, B25
Owner: Expert (see Approval record) · Approval date: 2026-07-18 · Supersedes: —

## Problem
The layer rule is stated in the report but not frozen as policy: which transaction families require a BVM operational voucher, an ERP-Lite journal, both, or neither. Without it, B3/B6/B9 could wire money paths inconsistently (e.g. refund voucher without journal, or journal without voucher).

## Frozen separation (invariant)

```text
Business event ≠ BVM operational voucher ≠ operational payment/credit fact
≠ cash-drawer movement ≠ ERP-Lite journal
```

BVM owns operational voucher governance and wiring; ERP-Lite owns debit/credit accounting. No service may describe BVM as the ledger; `posting_status`/GL fields on vouchers belong to ERP-Lite alone.

## Proposed family matrix (historical draft — superseded by the approved matrix below)

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

## Recommended decision
Freeze the layer separation and confirm the family matrix, with failure coupling defined per event. *(Historical recommendation — adopted and finalized by the Approved decision below.)*

## Approved decision (Expert)

Freeze the responsibility boundaries as follows:

```text
Financial fact tables
= operational source facts

BVM
= governed business voucher/document layer

ERP-Lite
= accounting journals, ledgers and posting

Cash Drawer
= physical cash custody and reconciliation

Tax Document
= fiscal/legal document
```

Approved matrix:

| Transaction family | BVM responsibility | ERP-Lite responsibility |
| --- | --- | --- |
| Order settlement | Receipt/business voucher | Accounting posting |
| Later collection | Receipt voucher | Cash/AR posting |
| Refund execution | Refund/payment voucher | Revenue/liability/cash reversal |
| Stored-value funding | Receipt voucher | Liability recognition |
| Stored-value redemption | Settlement voucher linkage | Liability release and revenue/AR posting |
| Payment reversal | Reversal voucher or reversal line | Reversal journal where posting exists |
| Overpayment disposition | Linked settlement/disposition documentation | Liability/cash/AR posting |
| AR receipt allocation | Receipt voucher | Cash and AR posting |
| AR invoice | Not owned by BVM | AR/revenue/tax posting |
| AR write-off | Not owned by BVM | Write-off and allowance posting |
| Tax invoice/credit note/debit note | Not owned by BVM | Accounting effects from fiscal document events |
| Cash drawer float and count | Cash drawer operational fact | Accounting posting only where required |

Failure coupling:

* Operational financial facts and their required BVM voucher must commit transactionally when they form one business operation.
* ERP posting may occur asynchronously through an outbox.
* After the operational transaction commits, ERP posting failure must not delete or roll back the operational voucher.
* Failed ERP posting becomes a posting exception requiring retry and reconciliation.

## Rationale summary
Five layers with distinct custody make every money movement explainable exactly once per layer: the fact records what happened operationally, BVM governs the business document, ERP-Lite alone does debits/credits, the drawer tracks physical cash, and the tax document is the legal artifact. Transactional fact+voucher coupling prevents undocumented money movement, while asynchronous outbox posting keeps accounting failures from corrupting operational truth — a failed journal is a governed exception, never a rollback of reality.

## Implementation consequences
- B6 (ERP order-to-cash wiring) consumes outbox events and posts journals per the matrix; posting failures create retryable posting exceptions surfaced in reconciliation (B20) — never rollbacks of committed operational vouchers.
- B3 (stored-value funding), B4 (later collection), B9 (refund execution) create their required BVM vouchers transactionally with the operational facts (D010 keys).
- B13 (voucher reversal unwind) and B10 follow the payment-reversal row of the matrix; B14 keeps tax documents as a separate fiscal layer with ERP effects driven by fiscal-document events.
- B24/B25 own the ERP-only families (AR invoice/write-off, contract-liability recognition).
- No `posting_status`/GL fields ever migrate onto operational fact tables or BVM vouchers beyond ERP-Lite's own custody; reconciliation owns BVM↔GL agreement checks (B20).

## Affected work packages
[B03](../B03_Stored_Value_Funding_Capture.md), [B04](../B04_Later_Collection_BVM_Parity.md), [B06](../B06_ERP_Order_To_Cash_Event_Wiring.md), [B09](../B09_Refund_Execution_Parity.md), [B13](../B13_Voucher_Reversal_Operational_Unwind.md), [B14](../B14_Tax_Document_Runtime_Integration.md), [B20](../B20_Missing_Reconciliation_Checks.md), [B24](../B24_AR_Allocation_Writeoff_And_Period_Controls.md), [B25](../B25_Revenue_Recognition_And_Contract_Liability.md).

## Related decisions
[D008](D008_Stored_Value_Funding_Treatment.md), [D012](D012_Revenue_Recognition_Policy.md), [D004](D004_Refund_Vs_Reversal_Vs_Void.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Expert approver | — | APPROVED (Expert) — frozen five-layer boundaries + responsibility matrix + outbox failure coupling | 2026-07-18 | Recorded from the owner's authoritative decision pack (governance correction pass) |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Skeleton | Claude |
| 1.0 | 2026-07-18 | APPROVED (Expert) — boundaries, matrix, failure coupling recorded | Expert decision pack |
