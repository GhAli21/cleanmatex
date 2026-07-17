# B22 — Financial Registry Consolidation

## Metadata
Backlog ID: B22 · Severity: MEDIUM · Classification: MAINTENANCE_RISK · Status: NOT_STARTED
Authoritative report sections: §44, §50-B22
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md) (status custody)
Dependencies: none · Blocks: — · Recommended phase: Seq 9

## Confirmed problem
`PAYMENT_METHODS` is duplicated across constants/order-types.ts and constants/payment.ts with different importers; `VOUCHER_TYPE` vs `VOUCHER_TYPE_LEGACY` are dual vocabularies; RefundStatus has no exported registry (string literals); reconciliation used literal status strings (§44).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| constants/order-types.ts + constants/payment.ts | two PAYMENT_METHODS consts | drift risk (DB-mirror rule) |
| constants/voucher.ts:27/57 | legacy + canonical voucher types | dual vocabulary |
| order-refund.service.ts | 'PENDING_APPROVAL' literals | no RefundStatus registry |

## Required outcome
One module per registry (payment methods, refund statuses, voucher types) with re-exports for compatibility; grep-guard tests forbidding literals on money paths; recon imports lifecycle sets (done in B2 — guarded here).

## Scope
Constant consolidation, importer migration, RefundStatus export, deprecation notes on legacy voucher vocabulary.

## Out of scope
New FinancialBusinessTransactionType registry (created when §28 events are implemented — B6/B10 deliverables reference it).

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
| Reconciliation | NO |
| Customer receipt | NO |
| Audit/outbox | NO |

## Acceptance criteria
Single source per registry; tsc + build green; DB-mirror values byte-identical before/after (CRITICAL RULE 12).

## Required tests
unit (registry equality snapshots), regression (build + typecheck).

## Dependencies and sequencing
Independent; safe refactor wave.

## Delivery surfaces

Backend services: registry modules consolidated (PAYMENT_METHODS single source; RefundStatus exported; voucher-type vocabulary deprecation notes); importer migration
Database/schema: none — DB-mirror values byte-identical (CRITICAL RULE 12 guard test)
API/endpoints: none
Frontend page/screen/dialog/action: NOT_APPLICABLE
Reason: constant/type consolidation with zero behavior change
Existing consumer: every importer of the affected constants (TS compiler enforces)
Operational visibility: build + typecheck gates
Failure detection: registry equality snapshot tests; grep-guards for literals on money paths
Recovery method: revert commit
Reusable components/helpers: the registries themselves
Permissions: none
Validation: equality snapshots before/after
i18n/RTL: NOT_APPLICABLE
Accessibility: NOT_APPLICABLE
Audit trail: none
Observability: none beyond CI
Jobs/workers: none
Feature flag: none
Rollout: single reviewed refactor commit per registry
Rollback: revert commit

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
