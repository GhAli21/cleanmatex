# B17 — Currency Rounding Runtime

## Metadata
Backlog ID: B17 · Severity: MEDIUM · Classification: BLOCKS_FEATURE · Status: NOT_STARTED
Authoritative report sections: §15, §42, §50-B17
Required decisions: none (config model exists; activation is technical + D005-consistent)
Dependencies: [B15](B15_Currency_Defaults_And_Tolerances.md) (impl) · Blocks: —
Recommended phase: Seq 10

## Confirmed problem
`rounding_adjustment_amount` participates in the snapshot total formula but has no writer; `sys_currency_rounding_rules_cd` (mig 0290) is seeded but unconsumed — cash rounding is CONFIGURED_ONLY (§15.3-era finding, §42).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-financial-write.service.ts:766 | reads rounding_adjustment (always 0) | no writer |
| supabase/migrations/0290_currency_rounding.sql | rules table seeded | no runtime consumer |
| payment modal fx-rounding line | display-only | not persisted |

## Required outcome
Calculation engine applies the tenant-currency rounding rule (increment + mode) at the defined point (grand total, cash tender), persists the adjustment to `rounding_adjustment_amount`, and the snapshot/receipt/recon all reflect it consistently; rounding gain/loss event reserved for B6/B26.

## Scope
Rule resolution + application in `calculateOrderTotals`/settlement; writer for the column; receipt display.

## Out of scope
GL rounding gain/loss journal (B6); FX (B26).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | YES (rounded totals) |
| Payment facts | POSSIBLE (cash tender rounding) |
| Credit applications | NO |
| BVM | POSSIBLE (ROUNDING line type exists) |
| Cash drawer | POSSIBLE |
| Gateway or bank | NO |
| Tax documents | POSSIBLE |
| ERP-Lite GL | POSSIBLE (deferred) |
| Snapshot | YES |
| Reconciliation | YES |
| Customer receipt | YES |
| Audit/outbox | NO |

## Acceptance criteria
Tenant with 0.005 increment produces rounded grand totals with the adjustment persisted and `preview == submit == snapshot == receipt`.

## Required tests
unit (modes/increments), integration, regression (3-dp currencies).

## Dependencies and sequencing
After B15; align with B11 fixtures.

## Delivery surfaces

Backend services: rounding-rule resolution + application in calculateOrderTotals/settlement; writer for rounding_adjustment_amount
Database/schema: none new (column + sys_currency_rounding_rules_cd exist)
API/endpoints: preview/submit responses include the rounding adjustment line
Frontend page/screen/dialog/action: payment modal + receipts display the rounding line (existing fx-rounding-line component becomes persisted-value-driven); no new page
Reusable components/helpers: fx-rounding-line.tsx reuse; rounding helper in lib/money
Permissions: none
Validation: rule lookup per currency; adjustment bounds (< increment)
i18n/RTL: existing rounding labels; verify AR strings
Accessibility: NOT_APPLICABLE beyond display
Audit trail: adjustment persisted on order; snapshot JSON notes rule applied
Observability: recon: preview==snapshot==receipt equality incl. adjustment
Jobs/workers: none
Feature flag: rule-driven (tenant currency config) — no separate flag
Rollout: fixtures for 2/3-dp currencies + increments → staging → enable via config
Rollback: remove rule rows (adjustment returns to 0); column reverts to inert

## End-to-end operational flow

1. Tenant with a cash-rounding rule builds an order → preview shows grand total with a visible rounding line.
2. Submit persists the adjustment; receipt and snapshot show identical values; drawer tender matches the rounded total.

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
