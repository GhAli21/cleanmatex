# B21 — Loyalty Conversion Rate

## Metadata
Backlog ID: B21 · Severity: MEDIUM · Classification: MAINTENANCE_RISK · Status: NOT_STARTED
Authoritative report sections: §7 concern, §33 loyalty, §50-B21
Required decisions: none (config design is technical; liability valuation belongs to D012/B25)
Dependencies: none · Blocks: — · Recommended phase: Seq 9

## Confirmed problem
Loyalty redemption computes `pointsToRedeem = ceil(amount / (option.minAmount ?? 1))` — the payment-method `min_amount` field is semantically overloaded as the points-per-currency conversion rate (order-settlement.service.ts:317).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-settlement.service.ts:316–325 | min_amount reused as rate | wrong field; silent misconfig risk |
| loyalty.service.ts | redeemPointsTx takes points + monetary amount | rate resolution is caller-side |

## Required outcome
Explicit tenant-level loyalty conversion configuration (points-per-unit, rounding rule, min-redemption) resolved by a loyalty config service; `min_amount` returns to its real meaning; misconfiguration fails loudly.

## Scope
Config source (settings or loyalty config table — assess), resolution service, settlement call-site fix, backfill note for tenants relying on min_amount.
**Frontend surface (rule 7):** loyalty settings screen section for conversion rate, rounding rule, and min-redemption (tenant admin, permission-gated) — configuration must never require DB edits.

## Out of scope
Earn processing (B7); liability valuation (B25); tier logic (§33 NOT_FOUND items).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | YES (points debited per redemption) |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | NO |
| Reconciliation | YES (loyalty ledger link amounts) |
| Customer receipt | POSSIBLE (points shown) |
| Audit/outbox | NO |

## Acceptance criteria
Redemption uses the configured rate; min_amount changes no longer alter points math; missing config → explicit error.

## Required tests
unit, integration (settlement with loyalty leg), regression.

## Dependencies and sequencing
Independent.

## Delivery surfaces

Backend services: loyalty config resolution service; settlement call-site fix (order-settlement.service.ts:317)
Database/schema: config storage decision (tenant settings vs loyalty config table) — additive migration if table
API/endpoints: loyalty config read/write endpoints (settings-style)
Frontend page/screen/dialog/action: loyalty settings screen section — conversion rate (points per currency unit), rounding rule, min-redemption; validation messages; current-rate display on the payment modal loyalty leg
Reusable components/helpers: settings form pattern; rate formatter
Permissions: tenant-admin settings permission (existing settings gating; confirm with B27)
Validation: rate > 0; rounding rule from closed list; misconfig → explicit error at redemption, never a min_amount fallback
i18n/RTL: EN/AR settings labels + redemption errors
Accessibility: labeled inputs; error association
Audit trail: config change history (settings audit pattern)
Observability: redemption failures on missing config counted
Jobs/workers: none
Feature flag: none — config presence drives behavior; absence fails loudly
Rollout: settings screen + service → backfill guidance for tenants relying on min_amount → switch call-site
Rollback: revert call-site (documented min_amount fallback returns temporarily)

## End-to-end operational flow

1. Tenant admin sets the conversion rate on the loyalty settings screen.
2. Cashier applies a loyalty leg → points computed from the configured rate, shown on the modal before submit.
3. Missing/invalid config blocks redemption with a clear message pointing to settings — never silent wrong math.

UI states: standard Cmx state contract — loading, empty (no rate configured), validation errors, permission-denied (settings section read-only with reason), duplicate-click protection, processing, success, retry on failure; config change history visible per settings audit pattern.

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
