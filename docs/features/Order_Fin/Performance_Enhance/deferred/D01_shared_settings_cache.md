# D01 — Shared settings cache

Status: **Deferred. Not approved. Not implemented by this performance plan.**

This is a future design investigation, not a cache deployment instruction. Return to the [implementation plan](../implementation_plan.md) or [pack overview](../README.md) for the approved boundary.

## Motivation and current evidence

[TenantSettingsService](../../../../../web-admin/lib/services/tenant-settings.service.ts) currently resolves settings through the legacy `fn_stng_resolve_all_settings` RPC. Independent strict and forgiving calls can resolve the same tenant/branch/user context more than once. Request-local reuse is the first optimization; a cache shared across requests is a separate correctness decision.

The [PostgreSQL invalidator](../../../../../supabase/migrations/0071_sys_stng_resolver_functions.sql) deletes rows in `org_stng_effective_cache_cf`. Calling `fn_stng_invalidate_cache` does **not** evict Redis, a Node.js process map, a Next.js cache entry, or another server instance. Existing [override triggers](../../../../../supabase/migrations/0072_sys_stng_audit_triggers.sql) do not establish an application-wide cache invalidation contract.

Read-only local `pg_proc` inspection on 2026-10-24 confirmed that the deployed local invalidator deletes the PostgreSQL cache by `ALL`/`TENANT`/`BRANCH`/`USER` scope, with `TENANT` restricted to null branch/user rows; `security_definer` was false. This is not production verification and no DDL was executed.

The resolver can depend on user overrides, profile inheritance, subscription/plan constraints, and feature dependencies. Tenant and branch alone are insufficient cache keys. Currency remains independently authoritative in `org_currency_cf`; a settings cache must not become a currency fallback.

## Why outside the initial scope

An arbitrary 30–60 second TTL would introduce stale financial policy without an approved business rule. Instance-local maps have independent contents and cannot promise coordinated invalidation. Adding Redis does not solve invalidation by itself. This plan first removes repeated work inside one request, which requires no cross-request staleness allowance.

## Entry criteria

- Production-like stage timings show settings resolution remains material after request-local deduplication.
- HQ and tenant owners agree on the effective-settings source and supported invalidation/version contract.
- The team inventories all writers and dependent inputs, including HQ profile/plan/flag changes and branch/user inheritance.
- Live schema, trigger behavior, deployment topology, and cache-provider capabilities are verified. Migration source alone is not deployment proof.
- Financial consumers have an explicit freshness policy. If no stale interval is acceptable, a bounded TTL alone is rejected.

## Proposed design and tasks

1. Define an immutable resolved-settings snapshot with schema version, source version, scope, computation time, and validated values. Keep successful absence distinct from transport/resolution failure.
2. Key by authenticated tenant, normalized branch, authenticated user, and resolver version. Never infer scope from a caller-supplied tenant identifier.
3. Choose a shared store or an authoritative PostgreSQL resolved representation only after measuring operational cost. A per-instance map may only be an explicitly bounded secondary layer.
4. Design source-version checks or reliable invalidation events from authoritative writers. A tenant/profile update must invalidate all affected descendant branch/user snapshots; a branch update can affect user contexts in that branch.
5. Prevent stale-fill races: work started before invalidation must not repopulate a newer cache generation. Define fencing/version comparison and concurrent-miss coalescing.
6. Apply bounded size, key cardinality limits, expiry, stampede protection, and safe handling of cache outage. Direct authoritative reads remain the recovery path; required financial facts never degrade to guessed values.
7. Keep strict and legacy forgiving adapters over a common verified result. Never share a cached `{}` or zero produced by error recovery with strict financial readers.
8. Add redacted cache hit/miss/version/invalidation telemetry and compare authoritative versus cached results without exposing customer balances or secrets.

## Ownership and invariants

- **HQ:** owns settings management and supported consumption contracts. Coordinate authoritative invalidation with HQ; do not add tenant-side direct `sys_stng_*` or feature-flag table queries.
- **Tenant app:** owns quote orchestration, strict read behavior, and propagation of authenticated scope.
- **Database:** migrations belong to this repository. Any schema/function change requires a new reviewed migration; the user applies it. Do not modify historical migrations or apply SQL from this plan.
- **Money:** no unapproved stale financial decision, silent fallback currency, or stale policy authorizing a payment. Final submit still performs current authoritative checks.
- **Security:** no cross-tenant/user data sharing. Cache visibility is not permission authority. Avoid caching secrets and complete financial/customer responses.

## Required tests

- Tenant, branch, user, null-scope, and resolver-version isolation; inherited changes invalidate every affected context.
- Strict resolution error versus verified missing setting; failures never become successful cached empty maps.
- Simultaneous miss, update during fill, duplicate/out-of-order events, multi-instance invalidation, provider outage, eviction, and recovery.
- Profile, subscription, flag, tenant, branch, and user writer coverage; no unsupported direct system-table reads.
- Financial parity and final-submit freshness, including expired or changed configuration.

## Rollout and rollback

Begin with observational comparison and explicit operational approval. Enable cache reads only for a reviewed cohort and supported settings. Observe correctness, availability, invalidation lag, memory, and latency. Roll back by disabling shared reads and returning to the authoritative resolver; retain compatible schema until dependent deployments are removed. Automatic rollback requires an implemented and tested control, not a promise in documentation.

## Completion evidence

Required: approved freshness/ownership contract; writer and invalidation matrix; live schema evidence; parity and concurrency results; multi-instance failure/recovery evidence; measured latency distributions; rollback rehearsal; reviewed migration and user application record if applicable. None of these are claimed complete here.
