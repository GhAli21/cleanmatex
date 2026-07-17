# B20 — Missing Reconciliation Checks

## Metadata
Backlog ID: B20 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: NOT_STARTED
Authoritative report sections: §13, §50-B20
Required decisions: [D005](00_Phase_0_Financial_Semantics/D005_Canonical_Outstanding_Formula.md)
Dependencies: [B02](B02_Shared_Financial_Aggregation.md) (hard) · Blocks: —
Recommended phase: Seq 3 (design) / after B2 (implementation)

## Confirmed problem
`TAX_CALCULATION` and `DISCOUNT_VALIDATION` exist as check-name constants but are unimplemented (reconciliation.service.ts:66–71); D005 also mandates a new refunds-vs-reopen-policy consistency check replacing recon's dropped `+ processedRefunds` conservatism.

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| reconciliation.service.ts:73–117 | 35 executed checks; 2 constants excluded | implement or drop |
| §13 | recon must consume shared aggregation | new checks must too |

## Required outcome
Implement TAX_CALCULATION (tax facts vs engine recompute per mode), DISCOUNT_VALIDATION (discount facts vs rules/caps), and REFUND_REOPEN_CONSISTENCY (refund rows vs D003 policy) — all via the B2 shared module; `total_checked` updated.

## Scope
Three checks + severities + fixtures.

## Out of scope
Aggregation module (B2); BVM↔GL check (B6).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | NO |
| Reconciliation | YES |
| Customer receipt | NO |
| Audit/outbox | NO |

## Acceptance criteria
Injected tax drift / illegal discount / policy-violating reopen each produce exactly one issue; clean fixtures stay green; check count constant matches reality.

## Required tests
unit (each check), reconciliation fixtures, regression.

## Dependencies and sequencing
Implementation strictly after B2.

## Delivery surfaces

Backend services: three checks (TAX_CALCULATION, DISCOUNT_VALIDATION, REFUND_REOPEN_CONSISTENCY) in reconciliation/, consuming the B2 shared module; EXECUTED_CHECK_NAMES/total_checked updated
Database/schema: none (issues persist to existing recon tables)
API/endpoints: none new (existing recon run/read routes)
Frontend page/screen/dialog/action: NOT_APPLICABLE
Reason: new checks render through the existing reconciliation results screens — no new UI element beyond three new check names
Existing consumer: finance reconciliation screens + per-order financial-reconcile panel (display new check rows automatically)
Operational visibility: run results with per-check pass/fail as today
Failure detection: injected-drift fixtures per check
Recovery method: checks are read-only; disable by removing from EXECUTED_CHECK_NAMES
Reusable components/helpers: B2 aggregation module
Permissions: existing reconciliation:run/view
Validation: severities per check class
i18n/RTL: EN/AR labels for the three new check names
Accessibility: NOT_APPLICABLE (existing tables)
Audit trail: recon run rows as today
Observability: check pass-rate trend
Jobs/workers: scheduled recon (B19 infra) consumes automatically
Feature flag: none (additive checks)
Rollout: after B2; fixtures first
Rollback: remove check names from executed list

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
