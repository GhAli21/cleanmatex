# D003 — Refund Reopen-Due Rules

## Metadata
Decision ID: D003
Status: PROPOSED
Decision type: Settlement-semantics policy
Authoritative report sections: C1, §5, §8.2, §13, §34
Blocks: B1, B2, B9
Affects: B12 (amendment refunds), B33
Owner: —
Approval date: —
Supersedes: —

## Problem
`reopens_due_amount` is read by the snapshot outstanding formula but never written, so **no refund ever reopens an order balance**: a fully paid order refunded in cash stays `outstanding=0 / PAID` (C1). Reconciliation assumes the opposite (every processed refund reopens). The business question is unanswered: *when does returning value make the order payable again?*

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| order-refund.service.ts:311–335 | refund create never sets `reopens_due_amount` (DB default 0) | Writer needs an approved rule |
| order-financial-write.service.ts:779–786 | `outstanding = max(0, total − paid − credits + refund_reopens_due + credit_reversal_reopens_due)` | Formula is correct only if the column is populated per policy |
| reconciliation/order-checks.ts:198–200 | recon adds **all** PROCESSED refunds to expected outstanding | One of the two semantics must win (feeds D005) |
| order-financial-write.service.ts:450–472 | header `PAID` derived from gross paid+credits vs outstanding | Reopen is the only mechanism that can un-PAY an order |
| order-cancel-financials.service.ts:206+ | cancel unwind creates refunds post-tx | Refund-after-cancellation must not re-open a dead order |

## Invariants
1. `0 ≤ reopens_due_amount ≤ refund_amount` per row.
2. Σ(reopen amounts) can never push `outstanding` above the order total.
3. Reopen-due is set **once**, at processing, from the approved rule + declared source (D002); immutable afterwards.
4. No double counting: a refund paired with a credit-application reversal must not reopen what the credit exclusion already reopens.
5. A refund on a CANCELLED order never reopens due (there is no collectible service).
6. Over-refund protection (existing caps) remains authoritative regardless of reopen policy.

## Options

### Option A — Always reopen for real-payment refunds (reconciliation-compatible)
`REAL_PAYMENT_REFUND → reopen = refund_amount`; everything else 0.
*Benefits:* simple; matches current recon formula. *Risks:* wrong for goodwill/price-concession refunds (customer owes nothing, yet order re-opens as due); wrong after cancellation. Requires operational discipline to re-collect or write off.

### Option B — Source- and context-driven default (recommended)
| Source (D002) | Default reopen | Rationale |
|---|---|---|
| REAL_PAYMENT_REFUND, order active (service still owed/delivered) | refund_amount | money returned but sale stands — customer owes again |
| REAL_PAYMENT_REFUND, order CANCELLED or refund reason = price adjustment/goodwill | 0 | sale reduced or dead — nothing collectible |
| GIFT_CARD_RESTORE / WALLET_RESTORE / CUSTOMER_ADVANCE_RESTORE | 0 on the refund row | the paired credit-app reversal (status ≠ APPLIED) already raises outstanding via the credits term — invariant 4 |
| CUSTOMER_CREDIT_ISSUE / CREDIT_NOTE_ISSUE | 0 | tender kept; liability converts to customer credit — order stays settled |
| MANUAL_EXCEPTION | operator-entered value (0 default), reason mandatory | unclassifiable by definition; must be explicit |
*Benefits:* financially correct per scenario; auditable; recon aligns via D005. *Risks:* needs a reason/context input on real-payment refunds (small API addition). 

### Option C — Operator chooses per refund, no default
*Risks:* inconsistent books across cashiers; rejected as primary (kept only as the MANUAL_EXCEPTION escape hatch inside Option B).

## Recommended decision
**Option B.** Deterministic defaults by source and order context, with MANUAL_EXCEPTION as the only operator-valued path. Partial refunds reopen proportionally (each row carries its own amount); repeated refunds accumulate row-by-row under invariant 2; refund-after-amendment uses the post-amendment total as the cap base (D011).

## Financial rationale
Reopen-due is the bridge between cash movement and receivable truth: cash-out with the sale intact is a receivable again (Dr AR / Cr Cash in target GL); cash-out on a dead or reduced sale is a revenue reversal, not a receivable. Stored-value restores move liability, not settlement. Getting this wrong either hides collectible money (today's C1) or invents phantom receivables (Option A on goodwill).

## Runtime impact
`processRefund` (computes + writes reopen), refund API (optional reason/context field for real-payment refunds), snapshot (no formula change), reconciliation (aligns through D005/B2), cancel unwind (passes CANCELLED context).

## Database impact
Existing `reopens_due_amount` column suffices; CHECK `0 ≤ reopens_due_amount ≤ refund_amount` candidate (B1 assesses).

## Existing-data compatibility
Legacy PROCESSED rows keep 0 (current snapshot behavior unchanged for history); they are flagged via the legacy-classification warning, not retro-valued. No backfill without a reviewed evidence pass.

## Related decisions
[D002](D002_Refund_Source_Classification.md) (source input), [D004](D004_Refund_Vs_Reversal_Vs_Void.md) (reversal/void reopen fully by definition), [D005](D005_Canonical_Outstanding_Formula.md) (single consumer formula), [D006](D006_Credit_Application_Reversal_Rules.md) (invariant 4 pairing), [D011](D011_Order_Amendment_And_Delta_Rules.md).

## Affected work packages
[B01](../B01_Refund_Lineage_And_Reopen_Due.md), [B02](../B02_Shared_Financial_Aggregation.md), [B09](../B09_Refund_Execution_Parity.md), [B12](../B12_Order_Amendment_And_Financial_Delta.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| — | — | — | — | — |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Initial proposal | Claude (audit follow-up) |
