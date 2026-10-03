# WP05 — Access, Capability Policy and Commercial Proof Binding

**Status:** PARTIAL  
**Date:** 2026-10-03 (Asia/Muscat)  
**Authority:** active Edit Order V2 v3.0 pack and current repository evidence.

## Scope completed

WP05 adds a server-only tenant-side capability primitive at `web-admin/lib/services/order-change/order-change-capability.service.ts` and focused tests. It does not expose Preview, Apply, a new Edit UI, an operational route, a role assignment, a feature activation, a workflow transition, or a commercial writer.

The evaluator derives the policy target from the frozen operation code, so a request cannot select a more permissive target class. It requires an enabled `order_edit_v2` feature resolved at the future server boundary, a committed order, explicit `OPEN` or expired temporary access state, current workflow status, `orders:edit`, an exact profile binding, every specialized permission, and any required reason. Missing binding, unavailable status, permanent/active temporary block, missing permission, and hard structural/fiscal denials all return `DENY`. An override permission never bypasses a hard denial or blocked order access.

## Current-code reconciliation

`sys_wf_prof_ver_exec_cf` and `sys_wf_prof_ver_exec_gate_cf` model workflow transitions. Their required transition/action/channel shape makes them unsuitable for a commercial Change capability matrix. The live semantic resolver projects those transition artifacts and policy revision, but does not project `profile_policy_json` as Change policy. `lib/utils/order-editability.ts` remains a legacy compatibility predicate and is not used as V2 authorization.

The required authoritative source is an HQ-owned, immutable profile-version contract for the exact `(profile_version_id, workflow_status, operation_code, target_type)` tuple. It must publish decision, stable reason/message keys, reason requirement, specialized permission, and override permission. The tenant app must consume the published binding; it must not create a tenant migration or hand-maintain generated workflow catalog data. Until that contract exists, every missing tuple fails closed as `CAPABILITY_POLICY_BINDING_MISSING`.

## Review-proof contract

The WP05 proof primitive is deliberately separate from the workflow transition acknowledgement payload. It has a versioned, domain-separated HMAC input and constant-time signature verification. It binds:

- tenant, order, authenticated actor, expected edit version, and expected workflow version;
- source context, canonical intent, reason, and submitted decision digests;
- profile version/policy revision, policy facts, calculation fingerprint, and settlement-source fingerprint; and
- non-secret key identifier and a 300-second expiry.

Key material is an injected server-only interface. The module does not read a new or fallback environment variable, and it cannot decide key provisioning, deployment ownership, rotation, or grace-key behavior. A missing key fails closed. Completed idempotent replay remains a later durable Change-response lookup and is intentionally not handled by proof verification.

## Permission and feature-flag migrations

| File | Purpose | Operator-applied result |
|---|---|---|
| `supabase/migrations/0566_order_change_v2_permissions.sql` | Adds `orders:edit` and `orders:edit_override` catalog rows. | Applied locally and remotely; no default role grant is inserted. |
| `supabase/migrations/0567_add_feature_flag_order_edit_v2.sql` | Registers independent sensitive `order_edit_v2`, default `false`. | Applied locally and remotely; the tenant runtime catalog/type key is synchronized and remains default-off. |

The working tree contained an unrelated `0565_ntf_provider_accounts_senders.sql.draft`, so the newly authored files use `0566` and `0567`. The operator applied both migrations to local and remote databases and regenerated database types/Prisma schema. Read-only `npx supabase migration list` now verifies matching local/remote rows for `0566` and `0567`. The agent did not apply a migration.

The role mapping remains deliberately open. Existing `orders:post_settlement_edit` migrations grant `admin`, `finance_manager`, `super_admin`, and `tenant_admin`, but that is a comparison point only. The pilot approval must enumerate the current roles and approve holders separately for the base and override permissions.

## Validation

| Check | Result |
|---|---|
| Focused Jest capability suite | PASS — 17 tests: feature flag, explicit/missing binding, warning/reason/override outcomes, access states/expiry, proof identity/tampering/expiry/key unavailability. |
| Focused WP04/WP05 regression suites | PASS — 4 suites / 42 tests: capability, proof, context, schema bounds, and existing workflow-gate decisions. |
| Targeted ESLint on WP04/WP05 TS files | PASS. |
| `npx prisma validate` | PASS with pre-existing `SetNull` advisories; no schema change is part of WP05. |
| `git diff --check` for WP05 code and migrations | PASS. |
| Remote migration history listing | PASS read-only; local/remote both record `0566` and `0567`. |
| Platform inventory rebuild | PASS — feature-flag catalog refreshed to 299 entries and runtime copy synchronized. |
| Platform inventory validation | BLOCKED only by two pre-existing navigation-contract warnings for cash-transit and settings-permissions routes, outside WP05. |

## Remaining gates

1. HQ must define/publish the immutable commercial capability binding and its cache/currentness contract.
2. The permission pilot matrix must approve actual role mappings; then an additional reviewed migration may add only those grants.
3. A security owner must approve/provision Change proof key material, rotation and replay behavior.
4. Operator review/application of `0566` and `0567` must precede any runtime catalog sync; the flag remains default off.
5. WP10 and WP12 own Preview/Apply route integration, CSRF, distributed rate limiting, durable replay, and lock-time re-evaluation.

The repository-wide `npx tsc --noEmit --pretty false` was started twice but did not complete within the bounded validation window and produced no diagnostic output. The focused Jest and ESLint checks above cover the touched modules; a completed project typecheck/build remains a separate environment validation follow-up.

## WP06 readiness

WP06 may begin only with explicit approval and remains dependent on the WP05 evaluator's fail-closed interface. It may implement in-memory projection semantics, but must not treat legacy editability or absent profile bindings as permission to mutate.
