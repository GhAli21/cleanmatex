# D005 — Canonical Outstanding Formula

## Metadata
Decision ID: D005
Status: APPROVED (Expert)
Approval type: Expert
Selected option: Option A
Approved decision: Option A — the snapshot formula with the frozen component definitions is the single canonical aggregation authority; changing any component requires a superseding decision; B20 adds the refunds-vs-reopen-policy consistency check; under D003 v2 the `refundReopens` term is populated only by explicit REFUND_AND_REBILL and MANUAL_EXCEPTION rows (commercial refunds contribute 0), while reversal/void/bounce/chargeback affect outstanding through `effectivePayments` (status-set membership)
Rationale summary: outstanding is the platform's most-consumed financial figure; one fact-derived, policy-aware formula in one shared module is the only way reconciliation becomes a genuine control instead of a competing calculator
Decision type: Aggregation-authority policy
Authoritative report sections: §5 / §5.1, §13, C2, M9, B2
Blocks: B1, B2, B20, B33
Affects: every snapshot/reconciliation/receipt/balance consumer
Owner: Expert (see Approval record)
Approval date: 2026-07-16
Supersedes: —

## Problem
Two outstanding formulas exist (C2): the snapshot uses lifecycle status sets + APPLIED credits + reopen columns; reconciliation uses literal `'COMPLETED'` + any-active credits + all processed refunds. Receipts, order summary, customer balance, and AR each read whichever numbers they were pointed at. One formula and **one aggregation authority** must be decided before B1 writes reopen facts and B2 refactors consumers.

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| order-financial-write.service.ts:779–786 | `outstanding = max(0, total − paid − credits + refund_reopens_due + credit_reversal_reopens_due)` | candidate canonical formula |
| reconciliation/order-checks.ts:159, 140, 198–200 | literal `'COMPLETED'`; credits summed on `is_active` regardless of `application_status`; `+ processedRefunds` | four confirmed drift sources (§13) |
| constants/order-financial.ts:464–469 | COMPLETED set = {COMPLETED, CAPTURED, SETTLED}; PENDING/AUTHORIZED/FAILED sets defined | status-set membership must be frozen |
| order-financial-write.service.ts:128–141 | `isClearlyRealPaymentRow` nature filter on payments | filter belongs to the canonical definition |
| §5 tolerance 0.001 vs drawer 0.01 | inconsistent tolerances across layers (M5) | one tolerance policy needed |

## Invariants
1. Exactly **one formula**, implemented in exactly **one shared aggregation module**, consumed by: snapshot writer, reconciliation, receipts/prints, order financial summary, customer balance, AR sizing, and closing controls. No consumer re-derives components.
2. All component definitions (below) are part of the formula — a consumer may not substitute its own status set or row filter.
3. Reconciliation's role becomes verifying **facts vs snapshot through the shared module**, not re-deriving independent expectations.
4. Rounding: DECIMAL(19,4) storage, `round4` aggregation, comparison tolerance 0.001 for order-level checks (drawer physical-count tolerance stays a separate, documented constant).
5. Changing any component definition is a superseding decision, not a code edit.

## Component definitions (the decision)

```text
effectivePayments  = Σ org_order_payments_dtl.amount
                     WHERE is_active AND nature = REAL_PAYMENT (isClearlyRealPaymentRow)
                       AND payment_status ∈ COMPLETED set {COMPLETED, CAPTURED, SETTLED}
effectiveCredits   = Σ org_order_credit_apps_dtl.applied_amount
                     WHERE is_active AND application_status = APPLIED
refundReopens      = Σ org_order_refunds_dtl.reopens_due_amount
                     WHERE is_active AND refund_status = PROCESSED     (values per D003 v2 —
                     positive only for explicit REFUND_AND_REBILL / MANUAL_EXCEPTION rows)
creditRevReopens   = Σ credit-reversal reopen amounts                  (per D006; currently 0)

outstanding        = max(0, round4(total_amount − effectivePayments − effectiveCredits
                                    + refundReopens + creditRevReopens))
```

Pending/authorized/failed amounts are **reported buckets only** — never part of paid or outstanding (this also grounds B33: their mere existence is not a mismatch, per M9).

## Options

### Option A — Adopt the snapshot formula + D003-populated reopens as canonical (recommended)
Reconciliation drops `+ processedRefunds` and its literal status/credit filters, and calls the shared module.
*Benefits:* matches the persisted engine v5 semantics; refunds affect outstanding only through the policy-defined reopen (D003 v2: explicit rebill/manual-exception rows only — the "all refunds reopen" assumption was itself wrong policy); single change surface. *Risks:* recon loses its blanket-reopen conservatism — compensated by a new dedicated check (refunds vs reopen policy consistency, B20: every positive reopen row must carry REFUND_AND_REBILL or MANUAL_EXCEPTION context with reason).

### Option B — Adopt the reconciliation formula as canonical
*Risks:* every processed refund reopens due regardless of business meaning (wrong for goodwill/credit-note refunds, D003); requires rewriting snapshot engine v5 and reinterpreting stored history. Rejected.

### Option C — Keep two formulas, document the difference
Rejected — this *is* C2, the defect.

## Recommended decision
**Option A** with the component definitions above frozen. B2 implements the shared module and migrates consumers; B1 populates the reopen inputs; B20/B33 align checks and warnings to it.

## Approved decision (Expert)
**Option A** as recommended — see `Approved decision:` in Metadata for the binding text. Approval type: Expert. Selected for domain correctness (fact-derived, policy-aware formula preserving engine v5 history) and system integrity (one aggregation authority; reconciliation becomes a control, not a competitor).

## Financial rationale
Outstanding is the platform's single most-consumed financial figure (collection, AR sizing, close, receipts). Two formulas guarantee permanent false blockers or hidden receivables. Canonicalizing the fact-derived, policy-aware formula preserves engine v5 history and makes reconciliation a genuine control instead of a competing calculator.

## Runtime impact
New shared aggregation module (B2); recon order-checks rewritten to consume it; receipts/summary/customer-balance readers repointed; snapshot writer internally refactored to the same module (no output change expected for non-refund orders).

## Database impact
None decided here. B2 may add nothing; existing columns suffice.

## Existing-data compatibility
Historical snapshots stay valid (same formula family); orders with legacy refunds show recon deltas until B1 policy values exist — surfaced via the legacy warning, not silently absorbed.

## Related decisions
[D003](D003_Refund_Reopen_Due_Rules.md) (reopen inputs), [D006](D006_Credit_Application_Reversal_Rules.md) (credit-reversal term), [D001](D001_Payment_Lifecycle_And_Status_Transitions.md) (status-set custody), [D009](D009_Pending_Payment_Failure_Fallback.md).

## Affected work packages
[B01](../B01_Refund_Lineage_And_Reopen_Due.md), [B02](../B02_Shared_Financial_Aggregation.md), [B20](../B20_Missing_Reconciliation_Checks.md), [B33](../B33_Pending_Payment_Warning_Semantics.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Expert approver | — | APPROVED (Expert) — Option A | 2026-07-16 | Expert-selected option applied for domain correctness and system integrity; rationale summary in Metadata |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Initial proposal | Claude (audit follow-up) |
| 0.2 | 2026-07-16 | Delegated approval recorded, then reverted per folder CLAUDE.md; recommendation unchanged | Claude |
| 1.0 | 2026-07-16 | APPROVED — Option A | — |
| 1.1 | 2026-07-16 | Expert correction pass: approval normalized to APPROVED (Expert); refundReopens term aligned to D003 v2 (explicit rebill/manual-exception rows only); B20 consistency check sharpened | Expert review |
