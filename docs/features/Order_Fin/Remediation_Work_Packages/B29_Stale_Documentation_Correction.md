# B29 — Stale Documentation Correction

## Metadata
Backlog ID: B29 · Severity: LOW · Classification: MAINTENANCE_RISK · Status: NOT_STARTED
Authoritative report sections: §50-B29
Required decisions: none
Dependencies: none · Blocks: — · Recommended phase: Seq 3

## Confirmed problem
Docs claim behaviors runtime contradicts — flagship example: migration 0340 commentary implies refund lineage "backfilled/used" while the runtime never writes `refund_source_type`/`reopens_due_amount`; feature docs under docs/features/Order_Fin describe refund/reconciliation semantics that §13/§21 disprove.

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| supabase/migrations/0340 comments vs order-refund.service.ts | column docs vs no writer | stale claim (C1 context) |
| docs/features/Order_Fin/* status docs | pre-audit statements | contradict frozen report |

## Required outcome
Sweep Order_Fin docs: statements contradicting the authoritative report annotated with a correction banner + report-section link (no history falsification — annotate, don't rewrite shipped migration files: CRITICAL RULE 2 keeps migrations untouched; corrections live in docs).

## Scope
Docs sweep + correction annotations + index of corrected claims.

## Out of scope
The authoritative report itself (frozen); code comments (touched only within owning packages).

## Financial effects
| Area | Impact |
|---|---|
| All areas | NO (documentation-only) |

## Acceptance criteria
No Order_Fin doc asserts refund lineage, recon reliability, later-collection parity, or GL coverage beyond report verdicts; corrections list reviewed.

## Required tests
none (doc review checklist).

## Dependencies and sequencing
Independent; early to stop propagation of stale claims.

## Delivery surfaces

Backend services: NOT_APPLICABLE (documentation-only)
Database/schema: NOT_APPLICABLE (migration files themselves untouched — corrections live in docs)
API/endpoints: NOT_APPLICABLE
Frontend page/screen/dialog/action: NOT_APPLICABLE
Reason: documentation sweep — no runtime surface of any kind
Existing consumer: developers/reviewers reading docs/features/Order_Fin
Operational visibility: corrected-claims index reviewed in PR
Failure detection: doc-review checklist; future audits cross-check against the authoritative report
Recovery method: git revert of doc commits
Reusable components/helpers: correction-banner text pattern
Permissions: NOT_APPLICABLE
Validation: every banner links the report section that supersedes the claim
i18n/RTL: NOT_APPLICABLE (internal docs are EN)
Accessibility: NOT_APPLICABLE
Audit trail: git history
Observability: NOT_APPLICABLE
Jobs/workers: NOT_APPLICABLE
Feature flag: NOT_APPLICABLE
Rollout: single docs PR
Rollback: git revert

## Completion evidence
Migration: n/a · Implementation files: — · Tests: n/a · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
