# Tax Calculation and Financial Posting Specification

**Status:** Proposed design — no implementation authorised  
**Authority:** `cleanmatex` calculates and persists final tax outcomes. HQ uses the approved read-only preview contract only.  
**Related:** [tenant plan](TENANT_TAX_CONFIG_IMPLEMENTATION_PLAN.md) · [coordination plan](CROSS_PROJECT_TAX_IMPLEMENTATION_COORDINATION_PLAN.md)

## Invariants

- The server is the sole money authority. Browser and HQ previews are non-persisting explanations.
- A committed order records a complete, immutable tax outcome. Current rules never recalculate historic orders, tax documents, refunds, credits, or amendments.
- A configuration change creates a new effective version. It does not alter historical financial facts.
- All intermediate amounts use decimal arithmetic at `DECIMAL(19,4)`; display/settlement rounding follows the selected policy pack.
- A tenant has one pricing presentation mode: `TAX_EXCLUSIVE` or `TAX_INCLUSIVE`. A tax component cannot override it.

## Calculation semantics

### Tax point and effective-rule selection

The tax point is the server-generated timestamp at which an order's financial tax snapshot is committed. A client cannot submit or override it. The jurisdiction pack's IANA timezone converts it to the local tax date used for effective-rule and tax-period selection.

- A preview accepts an explicit candidate tax point for explanation only.
- Commit uses server time in the tenant jurisdiction timezone.
- A commercial amendment creates a new snapshot at its own commit tax point.
- Refunds, credits, and corrections reverse/reference the original snapshot; they do not select a new rule.

### Basic Mode percentage taxes

Basic percentage taxes are independent and apply to the same taxable net base after the established line/order discount allocation. Let `B` be that base and `r1..rn` be active percentage rates.

- **Exclusive:** `tax_i = round(B × r_i)`; `total = B + Σtax_i + ΣfixedLevies`.
- **Inclusive:** `net = gross / (1 + Σr_i)`; `tax_i = round(net × r_i)`; `total = gross + ΣfixedLevies`.
- Fixed levies are always additional/exclusive in Basic Mode. They are never embedded in an inclusive price.
- The jurisdiction pack sets the rounding scope. The phase-one default is line-level rounding for item taxes, order-level rounding for order levies, then summation of displayed components. Any residual uses the pack's explicit document-rounding rule and is recorded as a labelled rounding adjustment, never silently hidden.
- Mixed per-component inclusive/exclusive tax configuration and compound/tax-on-tax behavior are prohibited in Basic Mode.

### Basic fixed levies and Advanced Mode

A Basic fixed levy is `PER_ITEM` or `PER_ORDER`; it has no percentage rate and is calculated after the applicable base. Quantity/weight levies are Advanced Mode only.

Advanced Mode may add scoped eligibility, exemptions, scheduled versions, and compound taxes. A compound rule must declare a unique priority and a base of `NET_ONLY` or `NET_PLUS_PRIOR_TAXES`; equal priorities are invalid. The engine records each rule's base and result.

## Charge-kind and document/finance contract

| Kind | Configurable from tax setup | Tax document treatment | Financial/reporting treatment |
|---|---|---|---|
| `TAX` | Yes | Tax line with rate, base, treatment, and authority/policy reference. | Included in statutory tax total and tax reporting bucket. |
| `LEVY` | Yes | Separate labelled charge line; shown separately from statutory tax. | Included in order grand total but excluded from VAT/statutory-tax total unless the policy pack explicitly maps it to a statutory reporting bucket. |
| `FEE` | No, in phase-one tax setup | N/A to tax setup; handled by commercial pricing. | A commercial amount may itself be taxable; eligibility is decided by tax rules, not by relabelling it as a fee. |

Phase-one tax setup permits `TAX` and `LEVY` only. Persist every result with charge kind, type, treatment, profile/rule version, policy-pack version, tax point, base, amount, rounding, exemption rationale, currency, and stable source ID. Documents/reports read this snapshot, never today’s profiles.

## Authoritative preview contract

`HQ platform web → HQ platform API → private cleanmatex tax-preview endpoint → cleanmatex calculation service`

The proposed endpoint is `POST /internal/tax/preview`, owned by `cleanmatex`. It accepts target tenant, immutable order-input DTO, optional candidate tax point, and correlation ID. It uses service-to-service authentication, is read-only/idempotent, and returns lines, totals, selected rule versions, readiness warnings, and explanation. Platform API never writes money and does not expose the internal endpoint to browsers.

The service identity, secret storage, network route, and signing method are `TBD` pending cross-project contract approval.

## Activation and historic safety

- A new/changed configuration is a draft until preview and validation pass.
- Activation affects only snapshots committed at or after its effective tax point.
- An HQ-applied default never overwrites an active tenant configuration; it creates a reviewable candidate version.
- Existing configuration profiles may be mapped during migration. Historical orders, `org_order_taxes_dtl` facts, and issued documents are never backfilled, reclassified, recalculated, or edited.
- If an old configuration cannot be safely mapped, mark it `MIGRATION_REVIEW_REQUIRED` and prevent new use. Do not introduce an unknown value into financial history.

## Required test vectors

- one/multiple independent percentage taxes, inclusive and exclusive;
- item/order fixed levy; zero/negative/discounted base; pack rounding residual;
- effective-date boundary in jurisdiction timezone and DST-safe jurisdictions;
- closed period; expired/combined exemption; profile replacement;
- preview-versus-commit parity, concurrent activation/default writes, and stale-version rejection;
- refund, credit, and amendment against historic snapshots; and
- legacy order/tax-document read compatibility and migration-rehearsal reconciliation.
