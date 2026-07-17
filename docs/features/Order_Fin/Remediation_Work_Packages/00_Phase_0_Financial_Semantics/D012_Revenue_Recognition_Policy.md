# D012 — Revenue Recognition Policy

## Metadata
Decision ID: D012 · Status: PROPOSED · Approved decision: NOT YET APPROVED · Decision type: Accounting policy — **requires accounting-policy approval and IFRS 15 alignment; not approvable by engineering alone**
Authoritative report sections: §37, §39 target sketch, B25
Blocks: B25 · Affects: B6
Owner: — (finance/accounting owner required) · Approval date: — · Supersedes: —

## Problem
No revenue-recognition event exists for cash/POS orders at any lifecycle point; only AR-invoice creation posts a revenue-shaped journal. Payment received, receivable created, contract liability, tax liability, and revenue earned are not separated (§37).

## Decision points (to be resolved with the accounting owner)
- Recognition trigger per flow: cash/POS, prepaid, pay-on-collection, AR — candidate triggers: service completion, ready, delivery, collection, closure, invoice posting.
- Contract-liability creation for prepaid orders, customer advances, gift cards (sale = liability, D008), loyalty awards (points liability at earn).
- Breakage policy for gift cards and loyalty (recognition basis and timing).
- Reversal treatment on refund (D003 goodwill vs sale-reduction), cancellation, and amendment (D011).
- VAT/tax liability timing vs revenue timing (tax-point rules per jurisdiction — GCC-first).

## Invariants (proposed)
1. Cash receipt is never revenue by itself.
2. Every liability created (advance/GC/wallet/loyalty) has a defined release event.
3. Recognition events are idempotent, lineage-carrying ERP-Lite events (D007/D010), reversible via defined reversal events.

## Related decisions / affected packages
[D007](D007_BVM_And_ERP_Lite_Responsibilities.md), [D008](D008_Stored_Value_Funding_Treatment.md), [D011](D011_Order_Amendment_And_Delta_Rules.md) → [B25](../B25_Revenue_Recognition_And_Contract_Liability.md), [B06](../B06_ERP_Order_To_Cash_Event_Wiring.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| — | — | — | — | — |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Skeleton | Claude |
