# D011 — Order Amendment and Financial Delta Rules

## Metadata
Decision ID: D011 · Status: PROPOSED · Approved decision: NOT YET APPROVED · Decision type: Mutation-governance policy
Authoritative report sections: §10, §29, M4, B12
Blocks: B12 · Affects: B14, B25
Owner: — · Approval date: — · Supersedes: —

## Problem
Financially relevant order edits run through a legacy direct-update path (0.05 VAT fallback, inclusive-split assumption, header overwrite) with no amendment record, no delta, no settlement consequence (§29 UNSAFE_DIRECT_UPDATE). A governed amendment model must be frozen before B12 builds it.

## Frozen model (invariant)

```text
before snapshot → mutation → canonical repricing (calculateOrderTotals semantics)
→ after snapshot → delta
→ positive delta: additional collection (tender or POC/AR per policy)
→ negative delta: overpayment resolution (change/refund/customer credit per D003/D006)
→ AR / tax-document / BVM / GL adjustment (B14/B6 when wired)
→ snapshot recalc → reconciliation
```

1. Ordinary CRUD may never rewrite financial totals directly.
2. Every amendment writes an immutable amendment record (before/after totals, delta, actor, reason, lineage) — additive rows, no in-place history edits.
3. Amendments after AR invoice / tax document / GL posting require the corresponding adjustment document, not a silent recompute.
4. Repricing always uses the canonical engine with the tenant's tax pricing mode — never the legacy reverse-split.

## Decision scope
Allowed amendment window per workflow stage; approval thresholds (interacts B27); delta settlement defaults (collect-now vs POC); partial-fulfillment interaction; amendment of settled stored-value legs (D006).

## Related decisions / affected packages
[D003](D003_Refund_Reopen_Due_Rules.md), [D006](D006_Credit_Application_Reversal_Rules.md), [D010](D010_Financial_Idempotency_And_Lineage.md) → [B12](../B12_Order_Amendment_And_Financial_Delta.md), [B14](../B14_Tax_Document_Runtime_Integration.md), [B23](../B23_Legacy_Financial_Path_Retirement.md), [B25](../B25_Revenue_Recognition_And_Contract_Liability.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| — | — | — | — | — |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Skeleton | Claude |
