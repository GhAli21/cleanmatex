# D06 — Permission caching and token claims

Status: **Deferred. Not approved. Not implemented by this performance plan.**

See the [implementation plan](../implementation_plan.md) and [pack overview](../README.md). Authoritative batching is separately evaluated in [D07](./D07_authoritative_permission_batching.md).

## Motivation and current evidence

[permission-service-server.ts](../../../../../web-admin/lib/services/permission-service-server.ts) contains two different paths: `getUserPermissionsServer` can cache a list of permission codes, whereas `hasPermissionServer` calls the authoritative `has_permission` or `has_resource_permission` RPC. Their contracts must not be assumed interchangeable.

The list path maps rows to strings and therefore does not retain resource scope in its result. A flat cached code list or JWT permission list cannot be substituted for effective checks that may depend on scoped grants, overrides, denials, administrative semantics, current membership, or rebuild state. The existing cache's availability does not prove it is safe as endpoint authority.

## Why outside the initial scope

Permission admission is a security contract. A short TTL can still preserve revoked access, and a JWT can remain valid after a role changes. The performance plan must not turn a display/list cache into authorization authority or copy stale permissions into long-lived tokens.

## Entry criteria

- Inventory the exact deployed permission RPC definitions, effective grants/denials, scopes, administrative behavior, and every relevant writer/rebuild path.
- Document current role-change/revocation visibility requirements and any expressly approved consistency window.
- Establish a shared authorization contract before selecting Redis, process memory, token claims, or another cache.
- Measure actual authoritative permission latency and cache failure behavior; consider request-local exact-decision reuse and D07 batching first.

## Proposed design and tasks

1. Preserve authoritative server checks. Do **not** recommend JWT permission arrays as endpoint authority or flatten `has_resource_permission` into a code-membership test.
2. Restrict optional token claims to reviewed hints or a version identifier unless a separately approved security design proves complete effective authorization semantics and revocation. Hints must never authorize protected actions.
3. If caching complete effective decisions is approved later, define keys including authenticated user, tenant, permission, resource type/ID, and every relevant policy/version input. Validate null/global scope semantics explicitly.
4. Define role/grant/deny/membership change invalidation, rebuild completion visibility, session/logout cleanup, generation fencing, multi-instance delivery, and cache outage behavior.
5. Avoid authorizing on stale positive decisions. Never convert a failed permission query into a successful cache fill; distinguish infrastructure failure from an actual denial for operational recovery.
6. Bound cache size/TTL, protect permission payloads, prevent cross-tenant/user collisions, and prevent untrusted callers from selecting another user's cached authority.
7. Keep cached UI hints clearly separate from API admission. Preserve existing route literal permission declarations and access-contract/inventory tooling.

## Ownership and invariants

- **Tenant RBAC/auth owners:** authoritative permission contract, effective-permission rebuilds, API enforcement, and tenant membership.
- **HQ:** coordinate shared catalog or administrative management only when actually affected. No new permission code, role semantics, or plan behavior is assumed.
- **Database:** any new version/invalidation/schema support belongs to a new reviewed migration in this repository; the user applies it. No migration is authorized here.
- Required `orders:create` denial remains a denial. Optional `stored_value:view_balances` denial means restricted output, not a grant and not necessarily rejection of an otherwise allowed quote.
- Preserve resource scope, explicit deny/override/admin rules, session admission, CSRF, and price-override enforcement.

## Required tests

- Global and resource-scoped allow/deny combinations, wildcard/admin semantics, user overrides, role changes, grant revocation, inactive membership, and rebuild races.
- Identical permission code on different resources/users/tenants; null-scope handling; token claim tampering and stale version hints.
- Cache provider outage, missed/out-of-order invalidation, stale fill, key collision, eviction, and multi-instance behavior.
- Positive stale entry after revocation cannot authorize protected work; failed query cannot become an allowed cache entry.
- UI hint versus API decision separation and optional balance visibility versus mandatory create permission.

## Rollout and rollback

Begin with non-authoritative comparison against current RPCs and record differences. Any authority change needs explicit security approval and controlled rollout with revocation tests. Roll back to current authoritative RPCs; do not remove effective-permission infrastructure until all consumers no longer depend on the new path. Token claim changes require compatibility and refresh planning, not a quote-specific deployment shortcut.

## Completion evidence

Required: effective-permission semantic inventory; approved freshness/revocation contract; invalidation writer matrix; scoped/security parity tests; cache failure/recovery evidence; measured benefit; migration and user application record if relevant; rollback rehearsal. None are represented as completed by this document.
