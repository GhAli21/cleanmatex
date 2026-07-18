# D012 — Revenue Recognition Policy

## Metadata
Decision ID: D012 · Status: APPROVED (Expert)
Approval status: APPROVED
Approval type: Expert
Selected option: IFRS 15 performance-obligation model; v1 operational recognition at validated item/service completion; entity-specific over-time period-end adjustment available under accounting-owner implementation control
Approved decision: revenue recognition follows the applicable IFRS 15 performance obligation — never an unrestricted tenant preference and never derived from arbitrary operational workflow percentages; v1 operational subledger recognizes at validated completion; contract-liability taxonomy, gift-card/wallet/loyalty, breakage, refund-vs-reversal, VAT, and AR/ECL treatments per the binding sections below
Decision type: Accounting policy (IFRS 15-aligned)
Authoritative report sections: §37, §39 target sketch, B25
Blocks: B25 · Affects: B6
Owner: Expert (see Approval record) · Approval date: 2026-07-18 · Supersedes: —

## Problem
No revenue-recognition event exists for cash/POS orders at any lifecycle point; only AR-invoice creation posts a revenue-shaped journal. Payment received, receivable created, contract liability, tax liability, and revenue earned are not separated (§37).

## Recommended decision
Resolve the recognition triggers, liability taxonomy, breakage, reversal, and tax-timing questions before B25 builds recognition events. *(Historical framing — resolved by the Approved decision below. The accounting-owner involvement survives as an implementation control inside the approved policy, not as an open decision.)*

## Approved decision (Expert)

Revenue recognition is determined by the applicable performance obligation under IFRS 15. It is not an unrestricted tenant preference.

### Product-level operational policy

For CleanMateX v1:

```text
Operational service revenue recognition
= validated item/service completion
```

Do not automatically post revenue from arbitrary operational percentages tied to workflow stages (e.g. preparation/cleaning/QA/ready step weights).

Workflow status is not automatically accounting progress.

### Laundry and cleaning services

Laundry and cleaning services must be assessed under IFRS 15 to determine whether the obligation is satisfied over time or at a point in time.

Because customers may simultaneously receive and consume benefits from routine services, over-time treatment may be appropriate for some contracts.

However:

* do not make `OVER_TIME_BY_ITEM_PROGRESS` the universal system default;
* do not derive accounting revenue directly from operational status percentages;
* do not permit unrestricted tenant selection between over-time and point-in-time accounting.

### Approved v1 treatment

The operational subledger recognizes revenue when the item or service reaches validated completion.

Where an entity has an approved IFRS accounting policy requiring over-time recognition and incomplete work is material at a reporting date:

* ERP-Lite may post a period-end revenue adjustment;
* the progress method must be documented;
* the method must faithfully depict performance;
* progress must be reasonably measurable;
* the accounting owner must approve enabling that entity-specific adjustment method.

This accounting-owner approval is an implementation control, not an unresolved product decision.

### Performance obligations

Assess promised components separately.

Possible components include:

```text
laundry/dry-cleaning service
repair/alteration service
pickup service
delivery service
retail product
express service commitment
```

Rules:

* Pickup and delivery are separate performance obligations only when they are distinct under IFRS 15.
* Express surcharge is normally allocated to the related laundry service unless contract analysis identifies a separate distinct obligation.
* Retail-product revenue is recognized when control of the product transfers.
* Delivery revenue is recognized when the distinct delivery obligation is completed.

### Prepayments and stored value

Customer cash received before performance is not automatically revenue.

Typical treatment:

```text
Debit Cash
Credit Contract Liability
```

When the related service is completed:

```text
Debit Contract Liability
Credit Service Revenue
```

Classifications must remain distinct:

```text
CONTRACT_LIABILITY
FINANCIAL_LIABILITY
REFUND_PAYABLE
PROMOTIONAL_OBLIGATION
LOYALTY_PERFORMANCE_OBLIGATION
```

Do not post every customer balance to one generic liability account.

### Gift cards and wallets

* Closed-loop gift-card funding normally creates a contract liability.
* Order-specific advances normally create a contract liability.
* Refundable or cash-withdrawable wallet funds may create a financial/customer-funds liability.
* Promotional wallet bonuses must be tracked separately.
* Open-loop or multi-merchant instruments require separate analysis.

Required stored-value attributes should include, where relevant:

```text
is_refundable
is_cash_withdrawable
is_transferable
is_multi_merchant
funded_amount
promotional_amount
expiry_policy
breakage_policy
```

### Loyalty

Loyalty points create a separate performance obligation only when they provide a material right.

Where a material right exists:

1. estimate its stand-alone selling price;
2. allocate part of the original transaction price;
3. record a contract liability;
4. recognize the allocated revenue on redemption or valid expiry.

Promotional or goodwill points not connected to a sale may require a different treatment.

### Breakage

Breakage is not an unrestricted accounting-policy election.

Use this default operational control:

```text
breakage_estimation_enabled = false
```

This means proportional breakage is not estimated until sufficient reliable evidence and approval exist.

It does not mean expired or legally extinguished balances remain liabilities forever.

Breakage recognition must consider:

* reliable redemption history;
* expected entitlement;
* variable-consideration constraints;
* likelihood of customer exercise;
* unclaimed-property or similar legal requirements.

### Refunds and payment reversals

Commercial refund:

* may reduce transaction price or earned revenue;
* may create a refund liability;
* must reference the original transaction.

Payment reversal:

* removes the effectiveness of payment;
* may reopen AR or outstanding balance;
* does not automatically reverse earned revenue if performance was already completed.

Refund and payment reversal remain separate operations.

### VAT

VAT and similar qualifying taxes collected for authorities are not revenue.

Tax timing and revenue-recognition timing remain separate.

### AR and ECL

* Order Fin records operational receivable, settlement and allocation facts.
* ERP-Lite posts AR, revenue and cash journals.
* Expected credit loss is governed under IFRS 9 and belongs to the accounting/ECL layer, not the payment modal or operational order service.

## Rationale summary
Revenue must follow performance obligations, not cash movement, workflow telemetry, or tenant preference: cash receipt creates liabilities until performance, workflow stages are operational signals that do not faithfully depict IFRS 15 progress, and letting tenants pick between over-time and point-in-time would make comparability and audit impossible. Validated completion is the reliable v1 recognition point; entities with an approved over-time policy get a documented, measurable, accounting-owner-controlled period-end adjustment instead of a system-wide default. The liability taxonomy, breakage constraint, refund-vs-reversal separation, VAT exclusion, and IFRS 9 ECL placement keep every balance in its correct accounting home.

## Implementation consequences
- B25 implements: validated-completion recognition events per performance obligation (idempotent, lineage-carrying ERP-Lite events per D007/D010); the distinct liability classifications (CONTRACT_LIABILITY / FINANCIAL_LIABILITY / REFUND_PAYABLE / PROMOTIONAL_OBLIGATION / LOYALTY_PERFORMANCE_OBLIGATION); the stored-value attribute set (is_refundable, is_cash_withdrawable, is_transferable, is_multi_merchant, funded_amount, promotional_amount, expiry_policy, breakage_policy); loyalty material-right allocation; `breakage_estimation_enabled = false` as the default operational control; the entity-specific over-time period-end adjustment gated by the accounting-owner implementation control.
- B6 posts the journals (contract-liability release at completion; refund/reversal effects per this policy); B3/D008 feed the liability-side funding events; B19 expiry jobs respect the breakage/legal-extinguishment rules.
- B01/B10 alignment stands: commercial refunds and payment reversals remain separate operations — a reversal reopens balance via D001/D005 status membership without auto-reversing earned revenue.
- B14 keeps VAT/tax timing on the fiscal-document layer, separate from recognition timing; ECL belongs to the future accounting/ECL package split out of B26 — never the payment modal or order services.
- No operational workflow percentage may ever drive a revenue posting; any such configuration proposal requires a superseding D012.

## Affected work packages
[B25](../B25_Revenue_Recognition_And_Contract_Liability.md) (recognition + liability engine), [B06](../B06_ERP_Order_To_Cash_Event_Wiring.md) (journal wiring), [B03](../B03_Stored_Value_Funding_Capture.md) (liability funding side), [B19](../B19_Expiry_And_Idempotency_Jobs.md) (expiry/breakage jobs), [B14](../B14_Tax_Document_Runtime_Integration.md) (tax timing separation), [B21](../B21_Loyalty_Conversion_Rate.md) (loyalty valuation input), [B26](../B26_Enterprise_FX_Bank_Gateway_And_ECL.md) (ECL layer, post-split).

## Related decisions
[D007](D007_BVM_And_ERP_Lite_Responsibilities.md), [D008](D008_Stored_Value_Funding_Treatment.md), [D011](D011_Order_Amendment_And_Delta_Rules.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Expert approver | — | APPROVED (Expert) — IFRS 15 obligation model; v1 validated-completion recognition; accounting-owner control embedded as implementation control | 2026-07-18 | Recorded from the owner's authoritative decision pack (governance correction pass) |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Skeleton | Claude |
| 1.0 | 2026-07-18 | APPROVED (Expert) — full IFRS 15 policy recorded; accounting-owner requirement converted to an implementation control | Expert decision pack |
