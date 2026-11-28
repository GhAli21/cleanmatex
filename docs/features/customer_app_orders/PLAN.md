# Customer App Orders — Comprehensive Implementation Plan

**Status:** Proposed. Do not implement a phase until its predecessor gate is satisfied.

## Mandatory progress-maintenance task — every implementation step

After **each numbered task** in every phase, update the plan before beginning the next task:

1. Update `STATUS.md` with the task state (`Not started`, `In progress`, `Blocked`, or `Complete`), date, concise outcome, validation actually run, and unresolved risk.
2. Update the matching phase row below.
3. Update `DESIGN.md` if the task changes an invariant, API contract, data model, authority boundary, or lifecycle.
4. Do not mark a task complete from static review alone when database, browser, device, deployment, or provider proof remains pending.

| Phase | Status | Progress/status updated |
|---|---|---|
| 0 — Evidence and contract lock | Complete | [x] Tasks 1–5 recorded in STATUS.md |
| 1 — Database and authorization foundation | Review pending | [x] Tasks 1–5 recorded in STATUS.md; owner migration review/application remains required |
| 2 — Customer identity and session APIs | Not started | [ ] |
| 3 — Tenant dashboard and staff handoff | Not started | [ ] |
| 4 — Customer mobile identity and tenant selection | Not started | [ ] |
| 5 — Fast Quick Drop mobile request and tracking | Not started | [ ] |
| 6 — Detailed Order alignment | Not started | [ ] |
| 7 — Verification and release readiness | Not started | [ ] |

## Phase 0 — Evidence and contract lock

1. Read the remote database definitions for `sys_customers_mst`, `org_customers_mst`, `org_branches_mst`, `org_orders_mst`, existing session/token tables, order source/status catalogs, and document-sequence objects.
2. Record exact key order for all composite foreign keys before migration design.
3. Trace existing web-admin customer detail, order creation, Quick Drop, customer booking, and mobile session paths.
4. Decide whether the customer credential migration moves or retires the existing tenant-level password hash without dual password authorities.
5. Add/update this feature pack status before beginning Phase 1.

**Gate:** remote schema, public API contract, status vocabulary, and permission ownership are documented; no guessed DB names or duplicated auth authority.

**Progress task:** update Phase 0 status/evidence after each of tasks 1–5.

## Phase 1 — Database and authorization foundation

1. Create a new tenant-app migration draft for global customer credential state, tenant visibility, branch capability flags, request tables, order-request linkage, request codes, constraints, indexes, RLS, and catalog/permission seeds.
2. Add `customers:manage_credentials` and request-management permissions with migration-backed grants according to current RBAC patterns.
3. Add the Phase 1 request type/source/status controlled vocabulary and customer-safe status mapping. Start with documented database checks; promote a vocabulary to reusable catalog tables only when a second producer or admin configuration requires it.
4. Define retention, audit, lockout, temporary-PIN expiry, and session-revocation behavior.
5. Update `STATUS.md` after migration review readiness.

**Gate:** migration is fully documented, tenant-safe, Prisma-safe, forward-only, and reviewed by the user. It is not applied by the agent.

**Progress task:** update Phase 1 status/evidence after each of tasks 1–5.

## Phase 2 — Customer identity and session APIs

1. Replace tenant-first customer password logic with global email-or-phone credential lookup.
2. Implement generic login failure, lockout/rate limiting, temporary-password verification, forced-change, session issuance, refresh rotation, logout, and revocation.
3. Implement authenticated tenant membership/hidden-relationship APIs and branch eligibility API.
4. Add customer self-service hide/unhide endpoint with direct ownership checks.
5. Remove raw identity values from logs.
6. Update `STATUS.md` after API contract and tests complete.

**Gate:** no unauthenticated tenant enumeration; all customer/tenant ownership checks are explicit; every protected API accepts only valid customer session tokens.

**Progress task:** update Phase 2 status/evidence after each of tasks 1–6.

## Phase 3 — Tenant dashboard and staff handoff

1. Add credential generation/reset control to `/dashboard/customers/[id]` using Cmx components, permission gates, confirmation, one-time reveal, EN/AR messages, and audit feedback.
2. Add request queue/action entry to the existing order-creation surface or a dedicated request workspace, following navigation/access-contract rules if a new route is needed.
3. Implement one atomic request-to-order conversion use case; preserve request details as evidence and create the normal order only through current authoritative order services.
4. Refresh access contracts and platform inventories when routes, API permissions, or navigation change.
5. Update `STATUS.md` after each completed task.

**Gate:** staff cannot reveal old credentials, create two orders from one request, or cross tenant boundaries.

**Progress task:** update Phase 3 status/evidence after each of tasks 1–5.

## Phase 4 — Customer mobile identity and tenant selection

1. Add login selector and forms for email/password and country-code/mobile/password.
2. Add temporary-password replacement flow; block normal navigation until successful.
3. Persist access/refresh credentials only in secure storage; test restart, refresh, logout, revocation, and forced-change behavior.
4. Add tenant list, hidden-tenant management, and branch-selection flows with typed models/providers/repositories.
5. Add EN/AR strings and explicit RTL checks.
6. Update the mobile milestone/status documentation and this pack status.

**Gate:** the mobile app never retains secrets outside secure storage and cannot request tenant data outside the authenticated customer membership.

**Progress task:** update Phase 4 status/evidence after each of tasks 1–6.

## Phase 5 — Fast Quick Drop mobile request and tracking

1. Implement a progressive Fast Quick Drop flow with fulfillment, address, return-delivery, speed, estimated pieces, notes, and optional service-category/item declaration rows.
2. Submit only the request DTO; do not submit money or mutable catalog prices.
3. Add request list/detail/tracking and order-link display.
4. Show a clear handoff message after staff converts the request to an order.
5. Update status/progress documentation after the feature is complete.

**Gate:** each request submission is idempotent; request tracking and linked-order tracking remain customer-owned and tenant-scoped.

**Progress task:** update Phase 5 status/evidence after each of tasks 1–5.

## Phase 6 — Detailed Order alignment

1. Pass authenticated tenant and selected branch context into the existing booking bootstrap/submit contract.
2. Enforce branch/service/fulfillment eligibility server-side.
3. Retain server-owned quote and idempotency behavior.
4. Verify that measured/unsupported catalog items receive explicit customer-safe handling.
5. Update status/progress documentation.

**Gate:** the app cannot price locally or submit a catalog item outside the selected tenant/branch policy.

**Progress task:** update Phase 6 status/evidence after each of tasks 1–5.

## Phase 7 — Verification and release readiness

1. Database: migration static review, RLS/constraint checks, composite-FK and sequence checks; user applies only after review.
2. Backend: unit/service/API tests for credentials, enumeration resistance, lockout, membership, hiding, request creation, and single conversion.
3. Web-admin: focused component/API tests, lint, typecheck, UI checks, accessibility and EN/AR review.
4. Mobile: provider/service/widget tests, `melos analyze`, `melos format --check`, `melos test`, Android/iOS hardware smoke tests in EN/AR/RTL.
5. Operational: release APK/IPA, signing, production network permission, no secret/PII logs, crash reporting decision, and rollout/rollback plan.
6. Record actual evidence and remaining gaps in `STATUS.md`; do not describe unexecuted checks as passes.

**Progress task:** update Phase 7 status/evidence after each of tasks 1–6.

## Cross-repository boundary

`cleanmatex` owns database migrations and the tenant web/mobile contracts. No HQ change is planned unless a later approved decision requires an HQ-owned feature flag, plan limit, platform setting, or tenant provisioning behavior. If that occurs, update this plan with the integration contract before any cross-repository work.
