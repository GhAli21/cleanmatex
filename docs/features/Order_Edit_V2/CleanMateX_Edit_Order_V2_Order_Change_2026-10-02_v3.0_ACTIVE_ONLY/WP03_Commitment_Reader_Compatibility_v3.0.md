# WP03 Commitment Producers and Active-Reader Compatibility

**Date:** 2026-10-03 (Asia/Muscat)  
**Status:** DONE  
**Authority:** Active v3.0 Full Architecture, Production Implementation Specification, and living implementation plan. This is WP03 implementation evidence, not a replacement plan.

## Scope completed

The canonical staff submission aggregate now records initial commercial commitment only after order creation, settlement, and the existing tax-document attempt finish inside the same Prisma transaction. PostgreSQL supplies the commitment timestamp, the authenticated submit actor supplies the commitment actor, and the initial edit revision changes from zero to one in the same conditional update. A count other than one raises ORDER_INITIAL_COMMIT_CONFLICT and rolls the aggregate transaction back.

Canonical Quick Drop uses this same submission transaction and may therefore commit with zero detailed items. No created-at fallback, historical data classification, workflow-state reinterpretation, or payment/fiscal rewrite was introduced.

Current operational projections now explicitly use active rec_status rows: order detail/list item projections and piece counts, current piece and piece-preference reads, readiness counts, order detail snapshots, item-total recalculation, financial preference-source lookup, and workflow gate facts. A narrow post-completion verification corrected item and piece workflow-gate aggregate predicates from NULL-compatible COALESCE handling to rec_status = 1. The same inspection intentionally retains NULL compatibility for nullable operational issue and assembly/QA-task records; they are not governed commercial structure. The pickup-release expression is also retained because it is outside this commercial correction, although its current migration declares rec_status NOT NULL and so COALESCE is a no-op there. Removed rows remain available to their historical/audit authority and do not return through ordinary live reads.

Failed-Create compensation now verifies the server-side authenticated tenant against the caller value, requires the existing orders:delete permission, and refuses a non-null committed_at before deleting dependent facts.

## Source disposition

Only /api/v1/orders/submit-order has a verified atomic commercial boundary and is committed by WP03. Its authenticated route supplies the actor and tenant. The legacy Quick Drop action, alternate /api/v1/orders creator, public booking, remote/persisted drafts, and Split helpers remain unqualified by the [source matrix](WP02_Backfill_Source_Matrix.md); they remain uncommitted. Split children do not inherit commitment.

## Files changed

- web-admin/lib/services/order-submit-orchestrator.service.ts
- web-admin/app/actions/orders/delete-order.ts
- web-admin/lib/db/orders.ts
- web-admin/lib/services/order-piece-service.ts
- web-admin/lib/services/order-service.ts
- web-admin/lib/services/order-financial-write.service.ts
- web-admin/lib/services/workflow/workflow-gate-facts.service.ts
- web-admin/__tests__/helpers/order-submit-harness.ts
- web-admin/__tests__/services/order-submit-orchestrator.protection.test.ts
- web-admin/__tests__/services/order-piece-service.test.ts
- web-admin/__tests__/actions/orders/delete-order-action.test.ts
- web-admin/__tests__/services/workflow-gate-facts.service.test.ts

## Validation

- Focused Jest: 4 suites / 31 tests passed, including the workflow-gate facts contract suite proving commercial NULL, 0, and 1 handling after the narrow correction.
- Focused ESLint over changed WP03 files passed.
- Project-wide TypeScript no-emit did not complete within the focused validation window; the inherited WP01.5 typecheck gate remains separate and unresolved.
- Diff whitespace check passed with the repository's CRLF-aware setting.
- No migration, database reset, data mutation, V2 Preview/Apply, capability policy, Edit UI, Finance formula, workflow transition, feature flag, or permission seed was added.

## WP04 handoff

WP04 may begin only after explicit approval. It must use committed_at and edit_state_version as the commercial eligibility/version facts, expose state_version only as wfStateVersion, and preserve the explicit active-versus-historical reader boundary established here.
