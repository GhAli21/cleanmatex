# D011 — Order Amendment and Financial Delta Rules

## Metadata
Decision ID: D011 · Status: APPROVED (Expert)
Approval status: APPROVED
Approval type: Expert
Selected option: Governed amendment + delta model (the frozen-model invariant adopted and extended with the approved settlement/adjustment rules below)
Approved decision: all financially relevant order changes use the governed amendment/delta flow; direct overwriting of original financial totals is prohibited; positive/negative deltas resolve only through the approved settlement paths; existing tax documents / AR invoices / vouchers / journals are adjusted via proper documents, never silently rewritten; immutable lineage with before/after values, reason, actor, approval, timestamp
Decision type: Mutation-governance policy
Authoritative report sections: §10, §29, M4, B12
Blocks: B12 · Affects: B14, B25
Owner: Expert (see Approval record) · Approval date: 2026-07-18 · Supersedes: —

## Problem
Financially relevant order edits run through a legacy direct-update path (0.05 VAT fallback, inclusive-split assumption, header overwrite) with no amendment record, no delta, no settlement consequence (§29 UNSAFE_DIRECT_UPDATE). A governed amendment model must be frozen before B12 builds it.

## Recommended decision
Freeze the amendment→delta→settlement model (the invariant sketch below) before B12 builds it. *(Historical recommendation — adopted and finalized by the Approved decision.)*

Historical frozen-model sketch:

```text
before snapshot → mutation → canonical repricing (calculateOrderTotals semantics)
→ after snapshot → delta
→ positive delta: additional collection (tender or POC/AR per policy)
→ negative delta: overpayment resolution (change/refund/customer credit per D003/D006)
→ AR / tax-document / BVM / GL adjustment (B14/B6 when wired)
→ snapshot recalc → reconciliation
```

## Approved decision (Expert)

All financially relevant order changes must use a governed amendment and delta model.

Direct overwriting of original financial totals is prohibited.

Required flow:

```text
before snapshot
→ governed amendment request
→ canonical repricing
→ after snapshot
→ financial delta
→ settlement/refund/AR handling
→ tax/BVM/ERP adjustments
→ financial snapshot recalculation
→ reconciliation
```

Positive delta may be resolved through:

```text
collect now
pay on collection
AR invoice
approved customer balance application
```

Negative delta may be resolved through:

```text
cash/card refund
customer credit
wallet credit
credit note
stored-value restoration
overpayment resolution
```

Rules:

* Preserve immutable amendment lineage.
* Preserve before and after values.
* Preserve the reason, actor, approval and timestamp.
* If a tax document, AR invoice, voucher or journal already exists, do not silently rewrite it.
* Use credit note, debit note, adjustment document, reversal, replacement document or additional posting as appropriate.
* Exact monetary approval thresholds remain a permissions/configuration matter for the approval work package, but the governed amendment requirement is approved now.

## Rationale summary
§29's direct-update path rewrites financial history in place — untraceable, tax-unsafe, and irreconcilable. The amendment/delta model makes every change a governed, immutable, repriced fact whose money consequence resolves through the same approved settlement machinery as any other collection or refund, and it protects already-issued fiscal/accounting artifacts by requiring adjustment documents instead of silent recomputes. Thresholds are configuration (B27), not policy — deferring them does not weaken the governance requirement.

## Implementation consequences
- B12 builds the amendment record (immutable before/after snapshots, delta, reason/actor/approval/timestamp, lineage) and the delta-settlement router: positive → collect-now/POC/AR/approved-balance; negative → the D003/D006 refund/credit paths (refund rows carry the B01 amendment linkage; cap base = post-amendment total, already honored in B01 §5).
- B23 retires the legacy direct-update path (0.05 VAT fallback, reverse-split) once B12 lands; repricing always uses the canonical engine with the tenant's tax pricing mode.
- B14 supplies the tax-document adjustment artifacts (credit/debit note, replacement); B6/B25 post the ERP adjustments; B27 later provides the monetary approval thresholds as configuration.
- Amendment windows per workflow stage and stored-value-leg amendments follow D006's shared reversal operation.

## Affected work packages
[B12](../B12_Order_Amendment_And_Financial_Delta.md) (the model itself), [B14](../B14_Tax_Document_Runtime_Integration.md) (adjustment documents), [B23](../B23_Legacy_Financial_Path_Retirement.md) (legacy path retirement), [B25](../B25_Revenue_Recognition_And_Contract_Liability.md) (revenue effects of deltas), [B27](../B27_Financial_Permissions_And_Approvals.md) (approval thresholds as configuration), [B01](../B01_Refund_Lineage_And_Reopen_Due.md) (amendment linkage on refund rows — implemented 2026-07-17 with cap base per this decision).

## Related decisions
[D003](D003_Refund_Reopen_Due_Rules.md), [D006](D006_Credit_Application_Reversal_Rules.md), [D010](D010_Financial_Idempotency_And_Lineage.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Expert approver | — | APPROVED (Expert) — governed amendment/delta model with protected fiscal artifacts | 2026-07-18 | Recorded from the owner's authoritative decision pack (governance correction pass) |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Skeleton | Claude |
| 1.0 | 2026-07-18 | APPROVED (Expert) — amendment/delta governance recorded | Expert decision pack |
