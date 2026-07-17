# D008 — Stored-Value Funding Treatment

## Metadata
Decision ID: D008 · Status: PROPOSED · Approved decision: NOT YET APPROVED · Decision type: Money-capture policy
Authoritative report sections: C3, §7, §33
Blocks: B3 · Affects: B6, B19, B25
Owner: — · Approval date: — · Supersedes: —

## Problem
Gift-card sale, wallet top-up, and customer-advance receipt write their stored-value ledger rows but capture **no tender**: no payment fact, no BVM voucher, no drawer movement, no GL liability (C3). The funding side of stored value is financially invisible.

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| gift-card-service.ts:314–382 | sale = card mst + SALE txn only | how must sale proceeds be tendered/recorded? |
| wallet/top-up/route.ts:36–43 → stored-value.service.ts:42–89 | balance + TOP_UP txn only; `'OMR'` default | same |
| stored-value.service.ts:190 | advance receipt — same pattern | same |
| customer-receipt-* services | receipt-excess path DOES create voucher lines (WALLET_TOPUP / ADVANCE_RECEIPT) | proves the target pattern already exists for one entry point |

## Invariants (proposed)
1. Any operation that accepts customer money creates a tender record (payment fact with method/status), a BVM receipt voucher line, and — when cash and drawer-required — a drawer movement, in one transaction (D010 keys).
2. Funding creates a **liability**, never revenue (GL: Dr Cash/Clearing, Cr GC/Wallet/Advance liability — B6/B25 wire it).
3. Promotional/bonus credit is a distinct, tender-less transaction type (expense/marketing treatment), never mixed with funded top-up.
4. Refund credit into wallet (D003 CUSTOMER_CREDIT path) remains tender-less — it moves existing liability.
5. Currency comes from tenant/branch resolution, never a literal default (B15).

## Decision scope
Which entry points are retrofitted vs deprecated (server actions vs API routes); whether funding reuses the settlement planner or a lighter tender path; expiry/breakage interaction (B19/B25); GC bonus treatment.

## Recommended direction
Reuse the customer-receipt voucher pattern for all funding entry points; one shared "stored-value funding" service.

## Related decisions / affected packages
[D007](D007_BVM_And_ERP_Lite_Responsibilities.md), [D010](D010_Financial_Idempotency_And_Lineage.md), [D012](D012_Revenue_Recognition_Policy.md) → [B03](../B03_Stored_Value_Funding_Capture.md), [B06](../B06_ERP_Order_To_Cash_Event_Wiring.md), [B19](../B19_Expiry_And_Idempotency_Jobs.md), [B25](../B25_Revenue_Recognition_And_Contract_Liability.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| — | — | — | — | — |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Skeleton | Claude |
