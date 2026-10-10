# WP05-B — HQ Order Edit Capabilities

**Status:** HQ authoring API and Studio tab are implemented against the applied 0597 foundation and 0599 atomic save command. `HQ_RBAC_ENFORCEMENT_ENABLED` proof is postponed until HQ RBAC itself is implemented. The tenant resolver still needs one Pilot-assignment check before WP05-B is complete.  
**Authority:** Active Edit Order V2 v3.0 pack, then verified current repositories  
**Owning applications:** `cleanmatex` owns shared migrations; `cleanmatexsaas` owns HQ API and UI; `cleanmatex` tenant runtime consumes the shared authoritative rows.  
**Relationship:** This completes the outstanding HQ-policy part of WP05. It does not start WP06, Preview, Apply, an Edit workspace, or commercial writers.

## 1. Goal

Provide the HQ-managed authority for one Order Change operation at one workflow status and target type. The product-facing name is **Edit Policy**. It is distinct from workflow transition configuration and from per-order `edit_access_status`.

The policy result is one of:

```text
ALLOW | ALLOW_WITH_WARNING | REQUIRE_OVERRIDE | DENY
```

The policy may make an operation stricter. It never bypasses tenant isolation, structural invariants, commitment, Finance, payment, tax, fiscal, delivery, or other hard domain denials.

## 2. Reconciled current-codebase decision

Existing Workflow Engine profile versions already implement the required lifecycle:

```text
DRAFT → PILOT → PUBLISHED → RETIRED
```

`PILOT` is editable and may be used by explicitly assigned pilot tenants. `PUBLISHED` is immutable. Existing `org_wf_profile_assign_cf` remains the workflow-profile assignment authority.

An Edit Policy is a separate aggregate linked to a specific `sys_wf_profile_ver_mst.version_id`. It has its own lifecycle and revision because one workflow profile version can have different controlled Edit Policies assigned to different pilot or production tenants. The Edit Policy UI is embedded in the existing Workflow Profile Version Studio, but product copy must say **Edit Policy**, never “profile version policy.”

The current semantic workflow configuration (`sys_wf_prof_ver_exec_cf`, gate rows, and `profile_policy_json`) is transition-oriented and remains separate. This work must not add an Edit Policy checksum, compiled artifact, policy JSON copy, generic rules engine, arbitrary SQL, or arbitrary expression language.

## 3. Final additive schema

### 3.0 `sys_wf_order_edit_ops_cd` and `sys_wf_order_edit_op_tgt_cd`

HQ must manage the finite Edit Policy vocabulary from the database, not from a UI-local hard-coded list. These two small global catalogs are the authority for valid policy rows:

The product decision calls this the “Order Edit Operations” catalog. The physical name uses `ops` because `sys_wf_order_edit_operations_cd` is 31 characters and exceeds the repository-wide PostgreSQL identifier limit of 30.

| Table | Contract |
|---|---|
| `sys_wf_order_edit_ops_cd` | One immutable frozen V1 operation code with bilingual display text, description, active state, and standard audit/lifecycle fields. |
| `sys_wf_order_edit_op_tgt_cd` | One permitted semantic target type for an operation. Its unique `(operation_code, target_type)` pair is the referenced policy-rule vocabulary. |

The migration seeds the thirteen frozen V1 operation codes and their fifteen valid operation/target pairs. `ADD_PREFERENCE` has three parent targets: `ORDER`, `ITEM`, and `PIECE`. This is a narrow configuration catalog, not a generic workflow action registry.

The tenant runtime continues to own explicit operation handlers and request schemas. Adding an HQ catalog row never creates a new executable operation; an unknown or unimplemented handler fails closed. The catalog controls authoring and rule validation, while the server controls executable business behavior.

### 3.1 `sys_wf_edit_policy_mst`

Global HQ-owned policy header. It has no tenant column and no tenant RLS.

| Column | Contract |
|---|---|
| `id` | UUID primary key. |
| `workflow_profile_version_id` | Required FK to `sys_wf_profile_ver_mst(version_id) ON DELETE RESTRICT`. The policy is valid only for this exact workflow profile version. |
| `policy_code` | Immutable machine code, unique for a policy lineage. |
| `name`, `name2`, `description`, `description2` | HQ display text using standard bilingual columns. |
| `lifecycle_status` | `DRAFT`, `PILOT`, `PUBLISHED`, or `RETIRED`. |
| `policy_revision` | Positive integer incremented for every Draft/Pilot save. This is the only policy freshness value required; it is not a checksum. |
| `pilot_started_at`, `pilot_started_by` | First Pilot promotion audit. |
| `published_at`, `published_by` | Publish audit. |
| standard lifecycle/audit fields | `created_*`, `updated_*`, `rec_status`, `rec_order`, `rec_notes`, `is_active`. |

Constraints and indexes:

- unique `(policy_code)`;
- unique `(id, workflow_profile_version_id)` for the assignment composite FK;
- `policy_revision >= 1`;
- check lifecycle values;
- indexes for profile-version/lifecycle lookup and active published/pilot policies;
- a published row cannot be updated or deleted except an explicit controlled retirement transition.

### 3.2 `sys_wf_edit_policy_rule_dtl`

Explicit operation matrix owned by one Edit Policy. No wildcard status, operation, or target rows are permitted.

| Column | Contract |
|---|---|
| `id` | UUID primary key. |
| `edit_policy_id` | Required FK to Edit Policy with `ON DELETE RESTRICT`. |
| `workflow_status` | Required FK to `sys_wf_statuses_cd(status_code)`; HQ validation also proves that this status belongs to the policy’s profile version. |
| `operation_code`, `target_type` | Required composite FK to `sys_wf_order_edit_op_tgt_cd`; the policy cannot configure an unsupported operation/target pair. |
| `decision` | `ALLOW`, `ALLOW_WITH_WARNING`, `REQUIRE_OVERRIDE`, or `DENY`. |
| `reason_code`, `message_key` | Stable machine and localization identifiers explaining the decision. |
| `requires_reason` | Requires an operator-entered business reason. |
| `required_permission_code` | Optional specialized tenant permission, FK to the permission catalog. |
| `override_permission_code` | Required for `REQUIRE_OVERRIDE`; normally `orders:edit_override`. |
| standard lifecycle/audit fields | Active governed rows use `rec_status = 1` and `is_active = true`. |

Constraints and indexes:

- unique `(edit_policy_id, workflow_status, operation_code, target_type)`;
- decision, reason, and override-shape checks;
- indexes for resolved policy matrix lookup;
- a rule of a Published policy cannot be inserted, updated, deactivated, or deleted;
- every Draft/Pilot matrix mutation advances `policy_revision`, so it invalidates prior review proof even if an administrative path bypasses the normal HQ save endpoint;
- `rec_status IS NULL` is never treated as active.

### 3.3 `org_wf_edit_policy_asg_cf`

Tenant-scoped controlled assignment. The `org_` prefix and RLS are mandatory because this table contains `tenant_org_id`.

| Column | Contract |
|---|---|
| `id` | UUID primary key. |
| `tenant_org_id` | Required tenant scope and explicit RLS predicate. |
| `workflow_profile_version_id` | Required resolved workflow profile version for the tenant assignment. |
| `edit_policy_id` | Required assigned Edit Policy. |
| standard lifecycle/audit fields | Assignment activation and audit. |

Integrity:

- composite FK `(edit_policy_id, workflow_profile_version_id)` references the master’s matching pair, so a policy cannot be assigned to a different workflow profile version;
- one active assignment per `(tenant_org_id, workflow_profile_version_id)`;
- assignments are permitted only for active `PILOT` or `PUBLISHED` Edit Policies whose workflow profile family has an active tenant workflow assignment; the runtime still matches the order’s exact stamped profile version;
- assignment to Draft or Retired, a profile mismatch, or a `rec_status` other than `1` fails closed;
- RLS, grants, and write paths follow existing `org_wf_profile_assign_cf` security conventions, with direct browser writes denied.

No separate policy-history table is added. HQ audit records provide change history. No key material is stored in any policy table.

## 4. Lifecycle and policy selection

| State | Editable | Assignable | Runtime use |
|---|---:|---:|---:|
| `DRAFT` | Yes | No | Never |
| `PILOT` | Yes | Yes, selected tenants only | Yes |
| `PUBLISHED` | No | Yes | Yes |
| `RETIRED` | No | No new assignment | Historical/audit only |

For a governed order, the resolver uses its stamped workflow profile version, then resolves exactly one active tenant-scoped Edit Policy assignment. It accepts only a matching `PILOT` or `PUBLISHED` policy and explicit active rules. Missing/malformed assignment, profile mismatch, duplicate active assignments, a Draft/Retired policy, or a missing rule returns `DENY`.

The resolver reads the shared database in the future Preview/Apply transaction. It does not call HQ over HTTP inside a commercial transaction. Published policies may later have explicit cache/invalidation support; Pilot policies are always read fresh.

Each result and review proof carries:

```text
editPolicyId + workflowProfileVersionId + policyRevision
```

A Pilot rule/assignment change increments `policy_revision`; a subsequent Preview/Apply must re-evaluate and require a new review when that identity differs. This is an integer revision check, not a checksum or a copied policy payload.

## 5. Seed policy family

The migration seeds Draft policy headers and explicit rules for the current verified system workflow profile versions only. It must not guess or hard-code tenant-specific workflow statuses and must not assign a tenant, grant a role, or activate `order_edit_v2`.

Initial policy codes align to verified system profile families when those profiles are present:

```text
ORDER_CHANGE_STANDARD_V1
ORDER_CHANGE_ASSEMBLY_QA_V1
ORDER_CHANGE_PICKUP_DELIVERY_V1
ORDER_CHANGE_OUTSOURCE_V1
ORDER_CHANGE_ISSUE_REPROCESS_V1
```

For every effective status in the linked profile, seed the 15 frozen operation/target tuples required by the V1 Operation Capability Catalog:

```text
ADD_ITEM / ORDER
REMOVE_ITEM / ITEM
CHANGE_ITEM_QUANTITY / ITEM
ADD_PIECE / ITEM
REMOVE_PIECE / PIECE
ADD_PREFERENCE / ORDER
ADD_PREFERENCE / ITEM
ADD_PREFERENCE / PIECE
CHANGE_PREFERENCE / PREFERENCE
REMOVE_PREFERENCE / PREFERENCE
CHANGE_PRIORITY / ORDER
CHANGE_SERVICE_SPEED / ORDER
CHANGE_READY_BY / ORDER
CHANGE_ORDER_NOTES / ORDER
CHANGE_CUSTOMER_SNAPSHOT / ORDER
```

`target_type` is the server-derived policy subject. An `ADD_PREFERENCE` has no persisted preference row yet, so its policy target is the validated parent scope: `ORDER`, `ITEM`, or `PIECE`. Existing preference mutation/removal targets the persisted `PREFERENCE` row. WP05-B corrects the current capability adapter and tests to this exact frozen mapping before persisting seed rows; no seed may reinterpret a target from browser data.

The seed is a reviewed starter matrix, not an automatic production authorization. It uses explicit mixed outcomes for the documented operational situation of each profile/status: early commercial statuses may contain approved `ALLOW` entries; in-progress operations may use warnings or overrides; fulfilled, payment-sensitive, fiscal-sensitive, and terminal statuses remain `DENY`. Every unapproved or unsupported tuple is explicitly `DENY` with `CAPABILITY_POLICY_NOT_ENABLED`.

The exact non-deny matrix is approved as seed data with Operations, Finance, Fiscal, and Security before the migration is authored. It must be evidence-based from the profile’s real status semantics, never inferred from a status name or legacy editability predicate. All seeds remain `DRAFT` and unassigned after migration; they cannot enable Edit Order V2.

## 6. HQ API and UI

Extend the existing `workflow-engine-config` module and Workflow Profile Version Studio. Do not build a parallel workflow service.

Required API capabilities:

- list/get/create/update/clone Edit Policy;
- atomic rule save with expected `policy_revision` and HTTP `409` on stale saves;
- policy check: coverage, frozen-token validation, lifecycle eligibility, rule shape, status/profile compatibility, permission existence, and assignment integrity;
- deterministic simulation for one status/operation/target;
- Draft → Pilot → Published → Retired lifecycle commands;
- tenant assignment CRUD subject to lifecycle and profile checks;
- effective-preview for HQ operators; and
- structured HQ audit for header, rule, lifecycle, and assignment changes.

Required UI capabilities:

- **Edit Policy** tab in Workflow Profile Version Studio;
- lifecycle indicator and actions;
- status/operation/target decision matrix with reason, warning, reason-required, specialized-permission, and override-permission fields;
- coverage/check panel, simulation panel, tenant-assignment panel, clone action, and revision/audit history;
- disabled controls for Published policies;
- EN/AR translations, RTL-safe layout, Cmx components, accessible table/editor interactions, loading, empty, conflict, and permission-denied states.

HQ must use separate permissions for view, manage Draft/Pilot rules, promote/publish, and tenant assignment, or document why existing workflow permissions are sufficient. The current `HQ_RBAC_ENFORCEMENT_ENABLED` deployment switch must be enabled and validated before this is treated as operationally enforced.

## 7. Tenant runtime contract

WP05-A’s pure capability evaluator remains the decision primitive. WP05-B adds a database-backed Edit Policy resolver and changes the evaluator input from an untrusted naked binding list to one homogeneous resolved policy.

It must:

- accept trusted tenant ID, order-bound workflow profile version, and workflow status;
- use explicit `tenant_org_id` conditions on every `org_*` query;
- require the resolved policy identity to match the order profile version;
- load only `rec_status = 1 AND is_active = true` rules;
- deny NULL/zero/inactive lifecycle rows;
- return `editPolicyId`, profile version, and revision in the result and review proof; and
- never trust browser policy identifiers, rule facts, actor permissions, or status declarations.

No Preview/Apply route is added in WP05-B. WP10/WP12 will call the resolver under their own lock-time re-evaluation boundary.

## 8. Security, operations, and proof keys

- HQ policy writes are server-only and use app-level HQ permission guards plus audit logging.
- Tenant users cannot directly mutate `sys_*` policy tables or `org_wf_edit_policy_asg_cf`.
- The change-review proof key remains server-only. It has an operational `keyId`, rotation, retirement, revocation, and incident runbook, but no new policy-key database table and no secret material in migrations, UI, logs, or browser code.
- `WORKFLOW_GATE_CHALLENGE_SECRET` is not a Change review-proof key and cannot be reused.
- Missing policy, rule, permission, workflow status, assignment, or hard-domain fact denies the requested operation.

## 9. Validation

Required focused tests cover:

- migration schema, comments, constraints, indexes, FKs, RLS, grants, and seed integrity;
- Draft/Pilot/Published/Retired lifecycle and published immutability;
- stale Pilot revision and policy-identity review invalidation;
- complete 15-tuple coverage, explicit missing-rule denial, inactive/NULL/zero `rec_status` exclusion, and duplicate assignment denial;
- tenant isolation and explicit tenant predicates;
- policy/profile mismatch, Draft/Retired assignment denial, and assignment replacement;
- all four decision outcomes, specialized permissions, override permissions, reason requirements, and hard-deny precedence;
- HQ API authorization/audit and `HQ_RBAC_ENFORCEMENT_ENABLED=true` deployment verification;
- HQ UI EN/AR/RTL/a11y and stale-save conflict behavior; and
- resolver/effective-preview parity without introducing N+1 policy reads.

## 10. Completion criteria and WP impact

WP05-B is complete only when a tenant order resolves exactly one assigned Pilot/Published Edit Policy for its workflow profile version, every requested frozen operation receives an explicit policy decision, missing state fails closed, Pilot changes invalidate stale review, Published policy is immutable, and HQ permissions/audit/RBAC enforcement are proven.

WP05 becomes `DONE` only after the WP05-A foundation and this WP05-B scope pass their tests and operational deployment gates. The WP01→WP20 order remains unchanged. WP06 remains blocked until WP05-B is complete; this specification does not authorize it.

## 11. Foundation implementation checkpoint

The operator confirmed that the shared foundation was applied to local and remote targets and that both repositories regenerated their database types and the tenant Prisma schema:

```text
supabase/migrations/0597_wp05b_order_edit_policy_foundation.sql
```

It adds the two frozen catalogs, policy header, explicit matrix, tenant assignment, reviewed indexes, RLS, least-privilege grants, lifecycle/assignment/grammar guards, and unassigned Draft starter policies. It does not create a tenant assignment, role grant, feature-flag change, Preview/Apply endpoint, commercial writer, or browser table access. The earlier `42702` Draft-seed ambiguity was corrected before this successful operator application; the transaction did not leave a partial 0597 install.

A second, additive forward migration is the atomic matrix-save command:

```text
supabase/migrations/0599_wp05b_edit_policy_save_command.sql
```

The operator applied 0599 locally. Generated database types in both repositories include `sys_wf_edit_policy_save`. The HQ authoring API calls that command for Draft/Pilot matrix replacement and returns HTTP 409 when the expected revision is stale.

Static migration contracts remain executable without database mutation:

```powershell
node scripts/validate-wp05b-order-edit-policy-migration.mjs
node scripts/validate-wp05b-edit-policy-save-migration.mjs
```

## 12. HQ authoring checkpoint

Implemented in `cleanmatexsaas` inside the existing workflow-engine-config module:

- `edit-policy.controller.ts` exposes catalog, list/get/create/clone, atomic matrix save, coverage check, simulation, lifecycle, organization assignment, effective preview, and audit.
- Matrix writes call `sys_wf_edit_policy_save`. Direct rule edits are not used for the Studio save.
- Assignment reads and writes always include `tenant_org_id`. The profile version on an assignment is copied from the policy header so the client cannot pair a policy with another version.
- HQ capabilities are `workflows.view`, `workflows.edit_policy`, `workflows.edit_policy_promote`, and `workflows.edit_policy_assign`. Existing `workflows.*` and `*` grants cover them. `*.view` can read and cannot mutate. No new role-seed migration is required for the current system roles.
- The Studio **Edit Policy** tab is bilingual and uses Cmx components. Published and retired matrices are read-only.
- Browser responses omit actor identifiers, provenance text, and review-proof material.

Remaining before WP05-B can be marked done:

1. `HQ_RBAC_ENFORCEMENT_ENABLED` proof is postponed. The operator will implement HQ RBAC separately. Until that switch is turned on, Edit Policy routes stay authenticated and the new `workflows.edit_policy*` capabilities are declared but not operationally enforced.
2. Exercise one Pilot assignment through the tenant resolver and confirm a missing tuple denies. There is no tenant Edit screen for this yet. Use the service check described in the living plan.
3. Invoke the documentation skill for the full implemented-feature pack after the resolver check passes.

