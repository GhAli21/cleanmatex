# B18 — Order Charge Write Path

## Metadata
Backlog ID: B18 · Severity: MEDIUM · Classification: BLOCKS_FEATURE · Status: NOT_STARTED
Authoritative report sections: M3, §4 limitation, §28 ORDER_CHARGE_APPLIED, §50-B18
Required decisions: none
Dependencies: none · Blocks: — · Recommended phase: Seq 10

## Confirmed problem
Submit always passes `chargeLines: []` (orchestrator:989) — `org_order_charges_dtl`, snapshot charge buckets, and recon charge checks are fully built but never fed; delivery/express amounts ride inside items/preferences instead of independent charge facts (M3).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-submit-orchestrator.service.ts:989 | chargeLines=[] | no writer |
| settleOrderTx §1 + snapshot :671–684 | full charge support (SERVICE/DELIVERY/EXPRESS/OTHER) | dormant |
| calculateOrderTotals | no charge params | engine gap |

## Required outcome
Charges (delivery, express, service) flow: UI/request → calc engine (`chargesTotal` in saleTotal and tax base per mode) → settle writes `org_order_charges_dtl` → snapshot buckets populate → recon charge checks pass; charge void supported via `is_voided`.

## Scope
Engine params + formula placement (gross = subtotal + charges), request schema, settle wiring, UI entry (order workspace), void action.

## Out of scope
Charge approval permissions (B27); amendment-driven charge changes (B12).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | YES |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO (voucher total covers) |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | POSSIBLE (taxable charges) |
| ERP-Lite GL | POSSIBLE (charge revenue mapping later) |
| Snapshot | YES (buckets live) |
| Reconciliation | YES (ORDER_CHARGES_MATCH_SNAPSHOT live) |
| Customer receipt | YES |
| Audit/outbox | NO |

## Acceptance criteria
Order with a delivery charge shows it as a discrete fact row, in the correct snapshot bucket, on the receipt, and recon-green; tax applies per charge taxability decision.

## Required tests
unit (formula placement + tax interaction), integration, UI, regression.

## Dependencies and sequencing
Independent; align tax treatment with B11.

## Delivery surfaces

Backend services: charge params in calculateOrderTotals (gross = subtotal + charges; tax base per mode); settle writes org_order_charges_dtl from orchestrator; void action service (is_voided)
Database/schema: none new (charges table + snapshot buckets exist)
API/endpoints: submit/preview schemas gain chargeLines; charge void endpoint
Frontend page/screen/dialog/action: order workspace charge entry (delivery/express/service picker with amounts), charge lines visible in totals panel and receipts; void action with reason on unsettled orders
Reusable components/helpers: charge-line editor component; totals panel extension
Permissions: manual-charge code via B27
Validation: charge type registry; taxability per charge; amounts ≥ 0
i18n/RTL: EN/AR charge labels + receipt lines
Accessibility: editor rows labeled; totals updates announced
Audit trail: charge rows carry source + actor; void reason
Observability: ORDER_CHARGES_MATCH_SNAPSHOT recon live
Jobs/workers: none
Feature flag: `order_fin.order_charges`
Rollout: engine + UI behind flag → staging (charges + tax + discounts interaction) → enable
Rollback: flag off — charges stop being writable; written rows remain consistent

## End-to-end operational flow

1. Operator adds a delivery charge in the order workspace → totals update live (engine-computed, taxed per mode).
2. Submit writes the charge fact; snapshot buckets populate; receipt shows the charge line; recon charge checks pass.
3. Voiding a charge before settlement recalculates totals with an audited reason.

UI states: standard Cmx state contract — loading, empty, validation errors, permission-denied (charge entry disabled with reason), duplicate-click protection (in-flight disable), processing, success, retry on failure; charge/void history visible on the order.

## Safety

UI design allowed: YES · UI implementation allowed: YES behind `order_fin.order_charges`
Production activation allowed: engine formula + fact-write path + UI activate as one unit (new capability — no unsafe-backend exposure)
Required backend gates: engine charge params + settle write path in the same release
Required decision gates: none (charge taxability follows the resolved tax mode)
Required verification gates: charges × tax × discounts interaction fixtures green

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
