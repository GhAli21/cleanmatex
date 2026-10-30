# D07 — Authoritative permission decision batching

Status: **Deferred. Not approved. Not implemented by this performance plan.**

See the [implementation plan](../implementation_plan.md) and [pack overview](../README.md). This preserves current database authorization semantics while investigating fewer round trips; it does not authorize flat-list caching from [D06](./D06_permission_claims_and_caching.md).

## Motivation and current evidence

The [quote route](../../../../../web-admin/app/api/v1/orders/payment-quote/route.ts) requires `orders:create`, optionally checks `stored_value:view_balances` for customer balance visibility, and applies the separate [price-override policy](../../../../../web-admin/lib/services/price-override-policy.service.ts) when lines contain overrides. [hasPermissionServer](../../../../../web-admin/lib/services/permission-service-server.ts) currently issues an authoritative RPC per check.

One server-side batch of exact decisions could reduce network round trips while preserving current policy. It must distinguish **mandatory action admission** from **optional response visibility** and conditional price-override permission. An AND over all requested permissions would incorrectly reject ordinary quotes when the user cannot view rich balances.

## Why outside the initial scope

A true authoritative batch requires a database/API contract and security parity review. Replacing the checks with `get_user_permissions` strings is not equivalent. Existing denials, overrides, administrative behavior, scoped resources, session context, and failure classifications must be preserved. The initial scope can reuse identical request-local decisions without introducing a new authority.

## Entry criteria

- Capture live `has_permission`, `has_resource_permission`, and effective-permission rebuild dependencies and semantics.
- Measure sequential permission RPC impact independently of identity and session validation.
- RBAC owners approve a bounded batch input/output contract and exact old/new semantic oracle.
- Inventory middleware/access-contract tooling affected by a batch adapter; preserve discoverable required permission declarations.

## Proposed design and tasks

1. Define bounded inputs as permission code plus optional resource type/ID. Derive user and tenant from verified server/database session context; never accept arbitrary identity as authority from quote JSON.
2. Return a keyed decision for each exact input and an unambiguous operation status. Reject malformed/partial results. Do not collapse all results into a single boolean.
3. Implement the batch through the same canonical policy engine as scalar checks, preserving explicit deny, user override, role/wildcard, administrative, tenant, and resource semantics. A loop may reduce network trips but must not be mislabeled a set-based database optimization.
4. Keep required `orders:create` admission fail closed. For `stored_value:view_balances`, a verified denial selects the restricted DTO; it does not deny an otherwise allowed quote. Define unavailable optional-check behavior explicitly and never expose protected fields on failure.
5. Include `pricing:override` only when applicable, preserving zero as a valid override and submit's audited reason requirement. Do not let optional visibility bypass an override denial.
6. Preserve the shared auth/session guard and CSRF boundary before financial work. Keep a thin route/service adapter; no quote-specific authorization fork.
7. Add typed server adapters, request-local exact-decision reuse, redacted timing/error metrics, and compatibility with route permission extraction and platform inventories.
8. Choose additive database function/grants after security review. Use a new migration; do not modify the deployed scalar functions solely to implement a shortcut.

## Ownership and invariants

- **Tenant RBAC/database owners:** canonical checks, new function/grants if approved, middleware integration, and generated access evidence.
- **HQ:** coordinate shared permission catalog/administrative contracts actually involved; do not change permission codes or role/plan semantics incidentally.
- Migrations belong to this repository and are applied by the user after review. Never apply a migration from this plan or edit historical files.
- Every tenant table accessed in new SQL must have explicit tenant predicates where applicable, including joined sources. Preserve RLS and scrutinize security-definer/search-path behavior if proposed.
- No cached flat list, JWT permission hint, or client-posted decision is authority. A failed or missing decision never grants access.

## Required tests

- Scalar/batch exact parity for allow, deny, explicit overrides, administrative and wildcard behavior, scoped resources, inactive membership, and effective-permission rebuild transitions.
- Required create allowed/denied crossed with balance view allowed/denied/unavailable; verify restricted DTO and no accidental quote rejection or balance disclosure.
- Conditional override permission, zero-price override, missing reason at submit, mixed line inputs, and permission revocation before final submit.
- Duplicate keys, empty/oversized batches, malformed scope, partial response, RPC outage, unauthorized caller, and cross-tenant/user attempts.
- Shared session/CSRF behavior, route declaration extraction, scoped access-contract checks, inventory regeneration, and quote/submit admission equivalence.

## Rollout and rollback

Start with controlled scalar/batch comparison, considering database work added by shadow checks. Enable the adapter for an approved cohort only when decisions and safe error behavior match. Keep the scalar path available for rollback. Do not fallback in a way that bypasses an explicit denial or obscures inconsistent results. Roll back adapter selection first; retire additive SQL only after compatibility review and a reviewed forward migration if needed.

## Completion evidence

Required: live policy definitions; RBAC/security approval; scalar/batch decision matrix results; optional visibility and override regression evidence; grants/RLS review; measured latency/database work; new migration review and user application record; access-contract/inventory evidence; rollback rehearsal. This remains a deferred proposal until those records exist.
