# WP04 Contracts and Canonical Change Context

**Date:** 2026-10-03 (Asia/Muscat)  
**Status:** DONE  
**Authority:** Active v3.0 Full Architecture, Production Implementation Specification, living plan, API Contract Catalog, Operation Capability Catalog, and Permissions/Security contract.

## Scope delivered

WP04 adds the typed V1 Change operation contract, a read-only canonical context loader, and GET /api/v1/orders/[id]/change-context. The endpoint keeps the established dynamic id segment, requires existing orders:read permission, derives the tenant and actor in middleware, and returns the V3 error envelope. GET is read-only and therefore does not use CSRF; later mutation routes must use the existing CSRF middleware.

The loader reads header, items, pieces, and unified preferences separately under explicit tenant and order predicates. Governed commercial rows use rec_status = 1. It preserves every persisted item, piece, and preference UUID; validates ORDER, ITEM, and PIECE preference shapes and their active parent hierarchy; keeps same-product lines separate; and maps physical state_version only to wfStateVersion.

Only committed orders at edit revision at least one and OPEN edit access receive a context. Missing commitment, invalid edit revision, blocked access, missing workflow version, and inconsistent hierarchy fail closed. Customer ID, branch ID, and currency are facts only. Current financial facts come from the existing tenant-scoped financial summary service. The loader performs no DML, transaction, policy binding, repricing, or workflow change.

WP05 owns orders:edit, orders:edit_override, feature enablement, policy bindings, capability decisions, review proofs, and configuration resolution. Consequently, WP04 exposes an explicit deferred state: canEdit/canOverride/canOverridePrice are false, featureEnabled is false, and capabilitySummary is DEFERRED with CAPABILITY_POLICY_PENDING. It does not substitute orders:update for a future Edit V2 permission.

## Workflow gate predicate recheck

The recheck found four remaining COALESCE(rec_status, 1) = 1 predicates in workflow-gate-facts.service.ts: one for operational order issues, two for operational assembly/QA tasks, and one for workflow release evidence. They remain unchanged. Commercial items and pieces already use explicit rec_status = 1, and that service does not query preferences. The nullable operational sources retain compatibility; the release column is currently NOT NULL, so its COALESCE is an operational no-op retained outside this commercial-reader correction.

## Files added

- web-admin/lib/constants/order-change.ts
- web-admin/lib/types/order-change.ts
- web-admin/lib/validations/order-change/order-change.schemas.ts
- web-admin/lib/api/order-change-bounded-json.ts
- web-admin/lib/services/order-change/order-change-context.service.ts
- web-admin/app/api/v1/orders/[id]/change-context/route.ts
- web-admin/__tests__/services/order-change/order-change-context.service.test.ts
- web-admin/__tests__/validations/order-change/order-change.schemas.test.ts
- web-admin/__tests__/api/v1/orders/change-context.route.test.ts

## Validation

- Focused WP04 Jest: 4 suites, 18 tests passed. This includes explicit NULL/0/1 active-row behavior, local-piece preferences, exact/plus-one request-body limits, graph fanout, nested UUIDs, text/proof/key bounds, rate-policy constants, and history pagination.
- Targeted ESLint passed.
- CRLF-aware diff check passed. The ordinary repository diff check reports unrelated CRLF worktree changes.
- The repository-wide TypeScript no-emit command did not complete within either focused validation window; no success result is claimed.
- `npm run build` reached Next.js optimized-production compilation after inventory sync and Prisma Client generation, but did not complete during the bounded validation window and was stopped. No successful build result is claimed.

## Finite-limit closure

WP04 freezes the shared limits in the API Contract Catalog and `ORDER_CHANGE_LIMITS`: 128 KiB streamed request body, 50 total operations, 25 new-item operations, 50 new-piece/new-preference operations, 50 selected piece IDs, 20 gate decisions, 500-character reasons, existing 500–1,000-character content/note fields, 4,096-character proof, 200-character idempotency key, and History default 20/maximum 100 with a 512-character opaque cursor. The bounded reader rejects a deceptive or absent content-length through streamed byte counting before JSON parsing. Preview/Apply rate policy is also frozen for its future route owners: generic tenant/user throttles plus Preview 30 actor/10 order and Apply 10 actor/5 order requests per minute.

The schemas now enforce request, graph, field, proof/key, and History query bounds. The future WP10/WP12 routes must invoke the bounded reader and Change-specific distributed limiter; this is frozen route integration, not an unimplemented WP04 acceptance gap because those routes do not exist yet.

WP05 remains NOT STARTED. No database migration, permission seed, feature flag, capability policy, Preview, Apply, UI, Finance behavior, or workflow behavior was added.
