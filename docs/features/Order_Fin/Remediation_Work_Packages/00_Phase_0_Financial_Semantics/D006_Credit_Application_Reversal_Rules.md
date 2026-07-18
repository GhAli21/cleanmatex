# D006 — Credit Application Reversal Rules

## Metadata
Decision ID: D006 · Status: APPROVED (Expert)
Approval status: APPROVED
Approval type: Expert
Selected option: Shared trigger-agnostic reversal operation (recommended direction adopted and extended)
Approved decision: credit-application reversal is a reusable financial operation (never cancel-only); exact-source ledger restore with lineage + idempotency; status-flip out of `effectiveCredits` is the single reopen mechanism (`credit_reversal_reopens_due = 0` stays); loyalty restoration becomes governed (`LOYALTY_RESTORE_PENDING`), never warning-only
Decision type: Settlement-semantics policy
Authoritative report sections: §7, §9, §30, §33, D005 credit-reversal term
Blocks: — · Affects: B2, B9, B12, B13
Owner: Expert (see Approval record) · Approval date: 2026-07-18 · Supersedes: —

## Problem
Credit-application reversal exists only inside cancel unwind (`reverseCreditApplicationTx`): ledger restore + status REVERSED. Refund-driven and amendment-driven reversals, loyalty restore, reversal lineage, and the `credit_reversal_reopens_due` term (hardcoded 0) are undefined.

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| order-cancel-financials.service.ts:180–196 | wallet/advance/GC restored; CN re-issued; LOYALTY → manual warning | per-type reversal policy incomplete |
| order-financial-write.service.ts (creditReversalReopensDueAmount) | `creditReversalReopensDueAmount = 0` hardcoded | when does reversing credit reopen due? |
| org_order_credit_apps_dtl.application_status | REVERSED excluded from effectiveCredits | exclusion already reopens outstanding — double-count risk with refund rows (D003 inv. 4) |

## Recommended decision
Extract cancel-unwind reversal into a shared, trigger-agnostic operation; keep status-flip-as-reopen as the single mechanism; automate loyalty restore. *(Historical recommendation — adopted and made binding by the Approved decision below.)*

## Approved decision (Expert)

Credit application reversal is a reusable financial operation and must not be implemented only as part of order cancellation.

Rules:

1. The reversal must reference the original credit-application row.
2. The exact original source ledger must be restored.
3. Reversal must be idempotent.
4. Reversed credit applications are excluded from `effectiveCredits`.
5. The outstanding amount reopens because the original application is no longer effective.
6. Do not add a second artificial "reopen due" amount on top of that effect.
7. Keep:

```text
credit_reversal_reopens_due = 0
```

8. Loyalty restoration must not remain a warning-only flow.
9. When automatic loyalty restoration cannot complete, create an explicit governed state such as:

```text
LOYALTY_RESTORE_PENDING
```

10. Pending restoration must be visible in reconciliation and operational exception reporting.

## Rationale summary
Reversal is needed by cancellation, refund restoration, and amendment decreases alike — implementing it cancel-only forces duplication and drift. The status flip out of `effectiveCredits` already reopens outstanding through the D005 formula, so any additional reopen amount would double-count (D003 invariant 4); freezing `credit_reversal_reopens_due = 0` makes that impossibility explicit. Loyalty restore as a silent warning loses customer value untracked — a governed pending state keeps the obligation visible until resolved.

## Implementation consequences
- Extract `reverseCreditApplicationTx` from cancel unwind into a shared, trigger-agnostic service operation (cancellation, refund-restore [B09], amendment decrease [B12], voucher unwind [B13]) with original-row lineage + D010 idempotency key per reversal.
- The D005 aggregation module keeps `creditReversalReopens = 0` permanently (already implemented that way in B02, 2026-07-17); a superseding decision is required before any code ever populates it.
- B01's refund pairing stands: `*_RESTORE` refund rows carry reopen 0; the paired reversal's status flip is the only outstanding mover.
- Loyalty: implement `LOYALTY_RESTORE_PENDING` as a governed application/restoration state surfaced in reconciliation (B20 adds the check) and exception reporting — replaces the current warning-only path in cancel unwind.
- Per-type restore matrix (wallet/GC/advance → ledger restore; CN → re-issue; loyalty → automatic or pending) is implemented in B13's unwind work with B09 consuming it for restores.

## Affected work packages
[B02](../B02_Shared_Financial_Aggregation.md) (credit-reversal term stays 0 — implemented 2026-07-17), [B09](../B09_Refund_Execution_Parity.md) (restore trigger), [B12](../B12_Order_Amendment_And_Financial_Delta.md) (amendment-decrease trigger), [B13](../B13_Voucher_Reversal_Operational_Unwind.md) (shared reversal operation + loyalty pending state), [B20](../B20_Missing_Reconciliation_Checks.md) (pending-restore visibility).

## Related decisions
[D003](D003_Refund_Reopen_Due_Rules.md), [D005](D005_Canonical_Outstanding_Formula.md), [D004](D004_Refund_Vs_Reversal_Vs_Void.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Expert approver | — | APPROVED (Expert) — shared reusable reversal, single reopen mechanism, governed loyalty restore | 2026-07-18 | Recorded from the owner's authoritative decision pack (governance correction pass) |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Skeleton | Claude |
| 1.0 | 2026-07-18 | APPROVED (Expert) — reusable reversal rules recorded | Expert decision pack |
