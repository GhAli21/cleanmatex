# D008 — Stored-Value Funding Treatment

## Metadata
Decision ID: D008 · Status: APPROVED (Expert)
Approval status: APPROVED
Approval type: Expert
Selected option: Full five-artifact funding capture (recommended direction adopted: shared funding pattern per the customer-receipt precedent)
Approved decision: every funded stored-value operation creates tender fact + BVM receipt voucher + stored-value ledger txn + drawer movement (cash, when drawer rules require) + ERP liability posting event; funding is never revenue; promotional value stays separate; refund-to-wallet is a liability transfer, not new tender; currency always from tenant/branch/document resolution
Decision type: Money-capture policy
Authoritative report sections: C3, §7, §33
Blocks: B3 · Affects: B6, B19, B25
Owner: Expert (see Approval record) · Approval date: 2026-07-18 · Supersedes: —

## Problem
Gift-card sale, wallet top-up, and customer-advance receipt write their stored-value ledger rows but capture **no tender**: no payment fact, no BVM voucher, no drawer movement, no GL liability (C3). The funding side of stored value is financially invisible.

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| gift-card-service.ts:314–382 | sale = card mst + SALE txn only | how must sale proceeds be tendered/recorded? |
| wallet/top-up/route.ts:36–43 → stored-value.service.ts:42–89 | balance + TOP_UP txn only; `'OMR'` default | same |
| stored-value.service.ts:190 | advance receipt — same pattern | same |
| customer-receipt-* services | receipt-excess path DOES create voucher lines (WALLET_TOPUP / ADVANCE_RECEIPT) | proves the target pattern already exists for one entry point |

## Recommended decision
Reuse the customer-receipt voucher pattern for all funding entry points; one shared "stored-value funding" service. *(Historical recommendation — adopted and made binding by the Approved decision below.)*

## Approved decision (Expert)

Any stored-value funding operation that accepts real money must create:

1. tender/payment fact;
2. BVM receipt voucher or voucher line;
3. stored-value ledger transaction;
4. cash drawer movement when funded by physical cash and drawer rules require it;
5. ERP liability posting event.

Applies to:

```text
gift-card sale
gift-card reload
wallet top-up
customer advance receipt
other funded stored-value issuance
```

Default accounting treatment:

```text
Debit:
Cash / Card Clearing / Bank Clearing

Credit:
Gift Card Liability
Wallet Liability
Customer Advance Liability
or the appropriate stored-value liability
```

Rules:

* Stored-value funding is not revenue.
* Revenue is recognized only when the related goods or services are transferred.
* Promotional bonus value must be stored separately from funded value.
* Refund-to-wallet is not a new customer tender.
* Refund-to-wallet transfers an existing refund obligation into a wallet/customer liability.
* Currency must come from the approved tenant/branch/document currency resolution.
* Never hardcode `OMR` or another currency.
* Closed-loop gift cards, refundable wallet funds, promotional balances, and order-specific advances must remain separately classified.

## Rationale summary
Money accepted without a tender fact, voucher, drawer movement, or liability is invisible to every control layer — C3 is exactly that hole. The five-artifact rule makes the funding side of stored value as governed as order settlement, the liability treatment matches IFRS 15/D012 (funding is a contract or financial liability, never revenue), and separating funded vs promotional vs refund-transferred value keeps the balances classifiable for D012's liability taxonomy and B19 expiry/breakage handling.

## Implementation consequences
- B3 implements one shared stored-value funding service reusing the proven customer-receipt voucher pattern for all entry points (GC sale/reload, wallet top-up, advance receipt), with D010 idempotency keys spanning the five artifacts committed transactionally (voucher+facts) and ERP posting via the D007 outbox.
- B6/B25 wire the liability posting events (Dr Cash/Clearing → Cr the specific stored-value liability); B25 keeps promotional bonus value in distinct, tender-less transaction types.
- B01's refund-to-wallet path already conforms: `topUpWalletTx` from a refund is a liability transfer keyed `refund-${refundId}-wallet`, never a tender fact.
- B15 removes literal currency defaults (the `'OMR'` fallback in stored-value paths) in favor of tenant/branch/document resolution.
- B19 expiry/breakage jobs and B25 classification consume the funded/promotional separation.

## Affected work packages
[B03](../B03_Stored_Value_Funding_Capture.md), [B06](../B06_ERP_Order_To_Cash_Event_Wiring.md), [B15](../B15_Currency_Defaults_And_Tolerances.md), [B19](../B19_Expiry_And_Idempotency_Jobs.md), [B25](../B25_Revenue_Recognition_And_Contract_Liability.md).

## Related decisions
[D007](D007_BVM_And_ERP_Lite_Responsibilities.md), [D010](D010_Financial_Idempotency_And_Lineage.md), [D012](D012_Revenue_Recognition_Policy.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Expert approver | — | APPROVED (Expert) — five-artifact funding capture, liability-not-revenue, separated classifications | 2026-07-18 | Recorded from the owner's authoritative decision pack (governance correction pass) |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Skeleton | Claude |
| 1.0 | 2026-07-18 | APPROVED (Expert) — funding treatment recorded | Expert decision pack |
