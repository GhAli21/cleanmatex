# D006 — Credit Application Reversal Rules

## Metadata
Decision ID: D006 · Status: PROPOSED · Approved decision: NOT YET APPROVED · Decision type: Settlement-semantics policy
Authoritative report sections: §7, §9, §30, §33, D005 credit-reversal term
Blocks: — · Affects: B2, B9, B12, B13
Owner: — · Approval date: — · Supersedes: —

## Problem
Credit-application reversal exists only inside cancel unwind (`reverseCreditApplicationTx`): ledger restore + status REVERSED. Refund-driven and amendment-driven reversals, loyalty restore, reversal lineage, and the `credit_reversal_reopens_due` term (hardcoded 0) are undefined.

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| order-cancel-financials.service.ts:180–196 | wallet/advance/GC restored; CN re-issued; LOYALTY → manual warning | per-type reversal policy incomplete |
| order-financial-write.service.ts:777 | `creditReversalReopensDueAmount = 0` hardcoded | when does reversing credit reopen due? |
| org_order_credit_apps_dtl.application_status | REVERSED excluded from effectiveCredits | exclusion already reopens outstanding — double-count risk with refund rows (D003 inv. 4) |

## Invariants (proposed)
1. Reversal restores the exact ledger the credit came from, with lineage to the original application row and idempotency key (D010).
2. A reversed application leaves `effectiveCredits` (status ≠ APPLIED); the paired refund row therefore carries reopen 0 (D003) — one mechanism, never both.
3. `credit_reversal_reopens_due` stays 0 unless a reversal is executed **without** a status flip (not currently possible) — revisit only if such a path is built.
4. Loyalty reversal must become automatic or explicitly queued — never a silent warning.

## Decision scope
Per-type rules (wallet/GC/advance/CN/loyalty) × per-trigger (cancellation, refund-restore, amendment decrease); partial reversal allowance; reversal after partial refund.

## Recommended direction
Extract cancel-unwind reversal into a shared, trigger-agnostic operation; keep status-flip-as-reopen as the single mechanism; automate loyalty restore.

## Related decisions / affected packages
[D003](D003_Refund_Reopen_Due_Rules.md), [D005](D005_Canonical_Outstanding_Formula.md), [D004](D004_Refund_Vs_Reversal_Vs_Void.md) → [B02](../B02_Shared_Financial_Aggregation.md), [B09](../B09_Refund_Execution_Parity.md), [B12](../B12_Order_Amendment_And_Financial_Delta.md), [B13](../B13_Voucher_Reversal_Operational_Unwind.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| — | — | — | — | — |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Skeleton | Claude |
