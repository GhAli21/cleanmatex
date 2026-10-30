# D02 — Set-based effective-settings resolver

Status: **Deferred. Not approved. Not implemented by this performance plan.**

See the [implementation plan](../implementation_plan.md) and [pack overview](../README.md). This document specifies a future cross-owner investigation.

## Motivation and current evidence

The bulk function in [migration 0071](../../../../../supabase/migrations/0071_sys_stng_resolver_functions.sql) loops over active setting codes and calls `fn_stng_resolve_setting_value` for each. The later scalar definition in [migration 0164](../../../../../supabase/migrations/0164_fix_stng_resolver_stng_code_ambiguity.sql) performs substantially more than simple override selection: profile inheritance, null/required handling, plan constraints, feature dependencies, and source tracking.

A set-based resolver could reuse profile chains and shared context rather than repeating them per setting. The actual benefit depends on the live function, catalog size, query plans, and caller pattern. Source inspection does not prove which definition is deployed remotely.

Read-only local `pg_proc` inspection on 2026-10-24 confirmed that `fn_stng_resolve_all_settings(uuid, uuid, uuid)` still loops over active catalog settings and calls the scalar resolver; `security_definer` was false. No production definition, query plan, or latency result was established and no DDL was executed.

## Why outside the initial scope

This changes a shared policy engine consumed beyond Payment V4. A superficially equivalent highest-priority-row query can alter required-value handling, constraints, dependency behavior, or source metadata. The initial performance work preserves policy semantics and reduces request-local duplication instead.

## Entry criteria

- Measure resolver internals with representative tenant/profile/catalog sizes and safe database plans.
- Capture live definitions and dependencies in the target environment; compare them with migration history.
- HQ and tenant owners approve a versioned contract and a financial parity strategy.
- Build fixtures for every implemented layer, including ambiguous/invalid inputs and successful unset values.
- Verify callers, grants, RLS behavior, and compatibility requirements before choosing an additive function or replacement.

## Proposed design and tasks

1. Extract the exact current resolution semantics into executable fixtures, including order-sensitive constraint application and errors.
2. Resolve authenticated tenant membership context, profile chain, subscription context, and applicable feature facts once through supported ownership boundaries.
3. Build candidate values with explicit precedence and source metadata. Preserve branch/user applicability and required/null policy; do not invent a simplified precedence rule.
4. Implement constraint/dependency handling with the same observable outcomes, or separately approve and document any deliberate correction.
5. Compare the proposed output with the authoritative scalar resolver for every setting and context. Include source layer/source ID and error classification, not only values.
6. Review indexes with `EXPLAIN` on safe representative data. Avoid assuming that one SQL statement performs constant work or requires a new index.
7. Preserve existing signature and grants where required, or publish an additive versioned API/function with an explicit migration path.
8. If considering a materialized/resolved table, define refresh, transaction visibility, dependency invalidation, stale-fill prevention, and recovery separately. A persisted snapshot is not automatically fresh.

## Ownership and invariants

- **HQ:** owns settings policy and management. Define the supported API/adapter here rather than adding tenant app reads of `sys_stng_*` or flag tables.
- **Tenant repository:** owns any shared database migration and tenant consumer integration.
- **Database operations:** create a new migration only after approval; never edit applied history. The user reviews and applies migrations. This document authorizes no execution.
- All `org_*` sources, joins, and mutations must explicitly scope `tenant_org_id` where the column exists. Preserve RLS and invoker/security behavior after review.
- Preserve feature/plan denial, user/branch inheritance, required/unset semantics, and failure-closed financial reads. No guessed currency or money values.
- Bound any recursion, reject cycles predictably, and preserve effective-time behavior. Do not cache unverified results.

## Required tests

- Catalog-only, profile chains, absent/inactive profiles, inheritance cycles/depth, tenant/branch/user overrides, null and required settings.
- Plan deny/min/max constraints and feature dependencies, including disabled/unavailable cases and malformed values.
- Source metadata, inactive settings, tenant isolation, unauthorized caller behavior, grants, and failure responses.
- Exact old/new output and error parity for realistic catalogs and randomized combinations; explicitly classify intentional differences.
- Concurrent policy updates and snapshot visibility; rollback compatibility with existing clients.

## Rollout and rollback

Run shadow comparison without using the proposed result for financial decisions. Progress to a small approved cohort only when mismatches are understood and blocked from financial admission. Monitor per-layer mismatch and resolver latency/error distributions. Keep the prior implementation callable during rollout. Roll back consumer selection first, then use a reviewed forward migration if database reversal is necessary; never rewrite historical migration files.

## Completion evidence

Required: live definition/dependency manifest; HQ contract approval; complete parity results; representative plans and timing distributions; security review; migration review and user application record; consumer compatibility and rollback rehearsal. Status remains deferred until those records exist.
