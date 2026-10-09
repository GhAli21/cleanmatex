# CleanMateX — WP05 Part 2: HQ Order Change Capabilities

## Codebase Evaluation + Final Architecture + Implementation-Plan Update Package

**Purpose:** This is WP05 Part 2 for the CleanMateX Edit Order / Order Change v3.0 initiative. Codex must first evaluate this proposal against the real codebase and database, reconcile names and existing structures, update the active v3.0 implementation plan, and only then implement. This work must be completed before WP06.

## 1. Mandatory Codex Task

Codex must inspect `sys_wf_profile_ver_mst`, workflow profile publishing/versioning, workflow statuses, current Order Edit V2 evaluator, permissions (`orders:edit`, `orders:edit_override`), feature flag, current proof/HMAC primitive, change-context/preview/apply contracts, current HQ platform API/UI, and all existing capability/action/config tables before adding anything.

For every proposal below, classify it as `KEEP`, `CHANGE`, `REUSE`, `REMOVE`, or `DEFER`. Reuse existing code/tables where equivalent. Then patch the active v3.0 plan so WP05 Part 2 is a hard prerequisite for WP06.

## 2. Existing V3 Rules to Preserve

- **Edit** = user-facing capability/process.
- **Change** = committed auditable business transaction.
- **Revision** = resulting commercial version.
- `edit_state_version` is commercial OCC/revision; workflow version remains separate.
- `orders:edit` is baseline permission.
- `orders:edit_override` never bypasses hard `DENY`.
- Stable UUID identity for committed item/piece/preference rows.
- Finance remains delta-based and Order Change does not directly settle money.
- Workflow transitions remain separate from commercial Change.

Frozen V1 operations:

`ADD_ITEM`, `REMOVE_ITEM`, `CHANGE_ITEM_QUANTITY`, `ADD_PIECE`, `REMOVE_PIECE`, `ADD_PREFERENCE`, `CHANGE_PREFERENCE`, `REMOVE_PREFERENCE`, `CHANGE_PRIORITY`, `CHANGE_SERVICE_SPEED`, `CHANGE_READY_BY`, `CHANGE_ORDER_NOTES`, `CHANGE_CUSTOMER_SNAPSHOT`.

Proposed fulfillment/address operations, subject to real-domain reconciliation:

`CHANGE_INBOUND_FULFILLMENT`, `CHANGE_OUTBOUND_FULFILLMENT`, `CHANGE_PICKUP_ADDRESS`, `CHANGE_DELIVERY_ADDRESS`, `CHANGE_FULFILLMENT_SCHEDULE`.

## 3. Two Policy Scopes

Use two distinct scopes:

- `EDIT_ACCESS`: Can the actor enter Edit Order mode at all?
- `CHANGE_OPERATION`: Once inside, can the actor perform this specific operation/field change?

A `DENY` in `EDIT_ACCESS` prevents the editor from opening. A `DENY` in `CHANGE_OPERATION` blocks only that specific change.

## 4. Preferred Wiring to `sys_wf_profile_ver_mst`

Preferred simplified model:

```sql
ALTER TABLE sys_wf_profile_ver_mst
  ADD COLUMN edit_policy_id UUID NULL;
```

`edit_policy_id` should reference the exact immutable published row in `sys_wf_edit_policy_mst`.

If direct wiring is feasible, do not also create `sys_wf_prof_ver_edit_policy_cf`. Codex must inspect current workflow-version artifact/FK structure first. If direct FK is unsafe due to the real schema, use an equivalent bridge only with explicit justification.

Minimalism: do not add checksum/hash/fingerprint/policy JSON copies. DRAFT profile versions may change `edit_policy_id`; PUBLISHED profile versions must not silently switch it.

## 5. Proposed HQ Catalogs

1. `sys_order_change_operations_cd`
2. `sys_order_change_decisions_cd`
3. `sys_order_change_target_types_cd`
4. `sys_order_change_target_levels_cd`
5. `sys_order_change_fields_cd`
6. `sys_order_change_fact_source_types_cd`
7. `sys_order_change_condition_facts_cd`
8. `sys_order_change_condition_types_cd`
9. `sys_order_change_condition_operators_cd`

Reuse existing equivalent catalogs if they already exist.

## 6. Decisions

Seed:

- `ALLOW` severity 10
- `WARN` severity 20
- `OVERRIDE` severity 30
- `DENY` severity 40

Most restrictive result wins:

`DENY > OVERRIDE > WARN > ALLOW`.

Never depend on row order.

## 7. Targets

Target types:

`ORDER`, `ITEM`, `PIECE`, `PREFERENCE`.

Target levels:

`NONE`, `ORDER`, `ITEM`, `PIECE`.

## 8. Editable Business Fields

`sys_order_change_fields_cd` should define semantic editable fields, for example:

`CUSTOMER_SNAPSHOT_NAME`, `CUSTOMER_SNAPSHOT_PHONE`, `CUSTOMER_SNAPSHOT_EMAIL`, `PRIORITY`, `SERVICE_SPEED`, `READY_BY`, `ORDER_NOTES`, `ITEM_QUANTITY`, `PREFERENCE_VALUE`, `INBOUND_FULFILLMENT_TYPE`, `OUTBOUND_FULFILLMENT_TYPE`, `PICKUP_ADDRESS`, `DELIVERY_ADDRESS`, `INBOUND_SCHEDULE`, `OUTBOUND_SCHEDULE`.

Recommended metadata includes target, value type, ownership domain, `change_handler_code`, sensitivity, and whether it affects pricing/tax/finance/workflow/delivery.

Do not implement generic arbitrary:

```sql
UPDATE <table> SET <column> = <value>
```

Each field change must use its domain handler.

## 9. Fact Source Types

`sys_order_change_fact_source_types_cd`:

- `BUSINESS_FIELD`
- `BUSINESS_FACT`
- `DB_COLUMN`
- `DERIVED`
- `CALCULATED`
- `CONSTANT`

Approved DB-column facts are allowed, but HQ selects a pre-approved fact code. HQ must not enter arbitrary table/column names.

## 10. Condition Facts

`sys_order_change_condition_facts_cd` should expose approved facts such as:

`ORDER_STATUS`, `ORDER_PAYMENT_STATUS`, `ORDER_TOTAL_AMOUNT`, `ORDER_TOTAL_PAID_AMOUNT`, `ORDER_OUTSTANDING_AMOUNT`, `ORDER_IS_QUICK_DROP`, `ORDER_HAS_SPLIT`, `ORDER_HAS_ISSUE`, `ITEM_STATUS`, `ITEM_STAGE`, `ITEM_QUANTITY`, `ITEM_HAS_ACTIVE_PIECES`, `PIECE_STATUS`, `PIECE_HAS_BARCODE`, `PIECE_HAS_OPERATIONAL_HISTORY`, `HAS_ISSUED_TAX_DOCUMENT`, `HAS_LINKED_AR_INVOICE`, `INBOUND_FULFILLMENT_TYPE`, `OUTBOUND_FULFILLMENT_TYPE`, `DELIVERY_JOB_STATUS`, `DELIVERY_CHARGE_AMOUNT`, `PICKUP_ADDRESS_EXISTS`, `DELIVERY_ADDRESS_EXISTS`, `CUSTOMER_TYPE`.

Conceptual metadata:

`fact_code`, labels/descriptions, `subject_type`, `data_type`, `source_type_code`, optional approved `source_table_name`/`source_column_name`, optional `resolver_code`, optional `calculation_code`, nullability, multi-value flag, active/display/audit fields.

Only seed facts actually supported by V1 domain code.

## 11. Condition Types and Operators

V1 condition types:

- `COMPARISON`
- `SET`
- `NULL_CHECK`

Reserve `EXPRESSION` and `REGEX` for future. Do not implement arbitrary expression language in V1.

Operators:

`EQ`, `NE`, `GT`, `GTE`, `LT`, `LTE`, `IN`, `NOT_IN`, `IS_NULL`, `IS_NOT_NULL`.

Validate operator compatibility with fact datatype.

## 12. Policy Master

`sys_wf_edit_policy_mst` represents one exact policy revision.

Recommended fields:

`id`, `policy_code`, `version_no`, EN/AR name/description, `policy_status` (`DRAFT|PUBLISHED|RETIRED`), `published_at`, `published_by`, system/active/audit fields.

Unique `(policy_code, version_no)`.

Published policy revisions are immutable. Retired revisions stay readable for pinned historical workflow profile versions but cannot be newly assigned.

No policy checksum/hash.

## 13. Capability Table

`sys_wf_edit_policy_cap_cf` conceptually contains:

- `edit_policy_id`
- `capability_scope_code`
- `workflow_status_code`
- optional `operation_code`
- optional `target_type_code`
- optional `target_level_code`
- optional `field_code`
- `default_decision_code`
- optional `reason_code`
- optional `message_key`
- `require_reason`
- optional `required_permission_code`
- optional `override_permission_code`
- display/active/audit fields

`EDIT_ACCESS` rows normally have no operation/target/field.

`CHANGE_OPERATION` rows identify operation/target/field as needed.

Missing required capability must fail closed, using the existing canonical error or a code such as `CAPABILITY_POLICY_BINDING_MISSING`.

## 14. Rule and Condition Tables

`sys_wf_edit_policy_cap_rule_cf` represents `IF conditions THEN decision` and holds result decision, reason/message, reason requirement, permissions, order/display/audit fields.

`sys_wf_edit_policy_cap_cond_cf` holds:

`edit_policy_cap_rule_id`, `condition_group_no`, `condition_seq`, `fact_code`, `condition_type_code`, `operator_code`, typed value columns (`value_text`, `value_number`, `value_boolean`, `value_date`, `value_datetime`, `value_json`), active/audit fields.

## 15. AND / OR Model

- Conditions in the same `condition_group_no` = AND.
- Different groups = OR.

Example:

`(DELIVERY_JOB_STATUS = ASSIGNED AND ORDER_TOTAL_PAID_AMOUNT > 0) OR HAS_ISSUED_TAX_DOCUMENT = TRUE`.

No nested generic AST or scripting engine in V1.

## 16. Runtime Evaluation

Recommended order:

1. Hard structural/security/domain checks.
2. Feature gate.
3. `orders:edit`.
4. Resolve order's workflow profile version.
5. Read `sys_wf_profile_ver_mst.edit_policy_id`.
6. Load exact published policy revision.
7. Evaluate `EDIT_ACCESS`.
8. If denied, stop.
9. Evaluate requested `CHANGE_OPERATION`.
10. Resolve only facts required by relevant rules.
11. Evaluate conditions.
12. Apply most restrictive result.
13. Run canonical Finance/Tax/Delivery/domain hard validations.
14. Return final decision.

Avoid N+1: load capability/rules, collect fact codes, batch-resolve facts.

## 17. Edit Screen Entry

When user clicks **Edit Order**, do not blindly open the editor.

Use `GET /api/v1/orders/{id}/change-context` or the canonical equivalent to evaluate `EDIT_ACCESS`.

Conceptual denied response:

```json
{
  "canEnterEdit": false,
  "accessStatus": "TEMPORARILY_BLOCKED",
  "decision": "DENY",
  "reasonCode": "ORDER_SPLIT_IN_PROGRESS",
  "messageKey": "orderEdit.access.splitInProgress"
}
```

UI shows a clear message and stops before opening the editor.

Keep access state separate from policy decision.

Access state:

`OPEN`, `TEMPORARILY_BLOCKED`, `PERMANENTLY_BLOCKED`.

Decision:

`ALLOW`, `WARN`, `OVERRIDE`, `DENY`.

`WARN` may require acknowledgment/reason. `OVERRIDE` may require `orders:edit_override`. `DENY` is never bypassed.

## 18. Operation-Level UI

Once editor opens, individual capabilities may differ:

- Order Notes -> ALLOW
- Ready By -> ALLOW
- Remove Item -> WARN
- Delivery Address -> OVERRIDE
- prohibited field -> DENY

Prefer visible explanation over silently hiding disabled fields/actions.

## 19. Mandatory Re-evaluation

Evaluate at:

- Edit entry/change-context
- Preview
- Apply under authoritative concurrency/transaction boundary

A stale browser result never authorizes Apply.

If effective policy changes after Preview, reload/evaluate and require re-review using the existing canonical code or `POLICY_CHANGED_REVIEW_REQUIRED`.

No policy checksum is required.

## 20. Examples

### EDIT_ACCESS

`PROCESSING` default ALLOW.

Rule: `HAS_ACTIVE_SPLIT = TRUE -> DENY`.

Result: editor never opens when split is active.

### REMOVE_ITEM

Default ALLOW.

`ITEM_STATUS IN (WASHING, DRYING) -> WARN`.

`ITEM_STATUS IN (QA, PACKED) -> OVERRIDE`.

`ITEM_STATUS = DELIVERED -> DENY`.

### CUSTOMER_SNAPSHOT_NAME

Default ALLOW.

`HAS_ISSUED_TAX_DOCUMENT = TRUE -> WARN`, optionally requiring actor reason.

This edits the order snapshot only, not global customer identity.

### OUTBOUND FULFILLMENT

Default ALLOW.

`DELIVERY_JOB_STATUS = ASSIGNED -> WARN`.

`DELIVERY_JOB_STATUS = PICKED_UP -> OVERRIDE`.

`DELIVERY_JOB_STATUS = COMPLETED -> DENY`.

`HAS_ISSUED_TAX_DOCUMENT = TRUE AND DELIVERY_CHARGE_AMOUNT > 0 -> OVERRIDE`.

Actual Delivery/Pricing/Finance/Tax side effects remain domain-owned.

## 21. Permissions and Reasons

`orders:edit` is baseline and should not be repeated on every row.

`required_permission_code` is for specialized extra permission.

`override_permission_code` may use `orders:edit_override`.

`reason_code` = machine-readable reason.

`message_key` = EN/AR i18n key.

`require_reason` = actor must enter business justification.

## 22. HQ UI

Expected conceptual path:

`Platform -> Workflow -> Workflow Profile -> Profile Version -> Order Change Policy`.

Profile Version screen shows the pinned policy. DRAFT can change assignment. PUBLISHED is read-only.

Policy editor manages:

- header/revision/status
- capabilities
- rules
- conditions
- publish/retire

HQ UI must be catalog-driven. No raw SQL/JS editor.

## 23. Backend Responsibilities

Expected components, reconciled to real codebase naming:

- Policy repository
- Fact resolver registry
- Condition evaluator
- Capability evaluator
- Edit-access evaluator

The fact resolver registry keeps Finance/Tax/Delivery formulas outside the generic rule evaluator.

## 24. Change-Context / Preview / Apply

`change-context` returns entry access plus enough operation/field hints for UX, current edit/workflow versions, and effective policy identity. Do not expose the entire rule database.

Preview re-resolves profile/policy, evaluates entry + all requested operations, resolves facts, performs pricing/financial/fiscal preview, and retains the current proof primitive.

Apply rechecks OCC/workflow/policy/access/operations/permissions/reasons and hard domain invariants before committing.

The current proof/HMAC primitive is not replaced by policy revisioning.

## 25. Hard-Deny Boundary

Hard security/domain invariants remain outside configurable policy, including tenant mismatch, foreign target, unsupported operation, OCC conflicts, and V1-prohibited identity/currency/branch changes.

Policy may be stricter than the domain. Policy may never weaken domain/security rules.

## 26. Publishing / Integrity

Codex must add/reuse PKs, FKs, uniqueness, indexes, audit, operator/datatype validation, and publish immutability.

Requirements:

- unique `(policy_code, version_no)`
- published policy cannot be edited
- published workflow profile version cannot silently switch `edit_policy_id`
- retired policy cannot be newly assigned
- missing required policy/capability fails closed
- workflow statuses referenced by a reusable policy must be compatible with the target profile version

No fuzzy status mapping.

## 27. Security

- HQ-only writes to `sys_*` policy config.
- Tenant users cannot mutate HQ policy.
- Server-side enforcement only.
- No arbitrary SQL/JS.
- No tenant/branch policy overrides in V1.
- Unknown policy/operation/fact/operator fails closed.
- Do not leak sensitive fact values in client explanations.

## 28. Testing

Must cover:

- seed/catalog integrity
- publish immutability
- profile-policy pinning
- missing binding fail-closed
- all V1 operators across datatypes/nulls/sets
- AND/OR truth combinations
- severity order independent of row order
- EDIT_ACCESS ALLOW/WARN/OVERRIDE/DENY
- temporary/permanent access states
- operation-level decisions
- Preview vs Apply stale-state/policy changes
- permission combinations
- cross-tenant isolation
- EN/AR/RTL
- no N+1 policy/fact queries
- performance baseline

## 29. Observability

Where consistent with current standards, record:

`order_id`, `tenant_id`, `actor_id`, `workflow_profile_version_id`, `policy_id`, `policy_version`, `scope`, `operation`, `target_type`, `field`, `decision`, `reason_code`, `matched_rule_count`, `duration_ms`.

Avoid PII/sensitive values.

## 30. WP05 Part 2 Work Packages

### WP05.2-A — Real-Codebase Discovery
Inspect current workflow/profile structures, WP05 evaluator/proof, catalogs, permissions, HQ API/UI, audit/RLS. Exit: written KEEP/CHANGE/REUSE/REMOVE/DEFER report.

### WP05.2-B — Catalog + Policy Schema
Create/reuse catalogs, policy master, capability, rule, condition, and preferred `sys_wf_profile_ver_mst.edit_policy_id`. Add constraints/indexes/seeds.

### WP05.2-C — Policy Repository
Load pinned published policy and fail closed.

### WP05.2-D — Fact Resolver Registry
Approved DB-column, business, derived, calculated facts with batch resolution.

### WP05.2-E — Condition + Decision Engine
Typed operators, grouping, severity, permissions/reasons.

### WP05.2-F — EDIT_ACCESS Integration
Change-context entry gate and UI response.

### WP05.2-G — CHANGE_OPERATION Integration
Per-operation/field/target capability.

### WP05.2-H — Preview/Apply Re-evaluation
Policy/OCC/workflow/proof integration.

### WP05.2-I — HQ Platform API/UI
Policy/revision/capability/rule/condition management; workflow profile-version assignment; publish validation; audit.

### WP05.2-J — Remaining WP05 Part 1 Gates
Real role grants/mapping, HQ immutable ownership, proof signing-key provisioning/rotation ownership, platform write security.

### WP05.2-K — Integration/E2E/Performance
DB/API/UI/security/isolation/RTL/performance tests.

## 31. WP06 Dependency Change

Update the living v3.0 plan so:

`WP05 Part 1 — existing evaluator/proof foundation`

`WP05 Part 2 — HQ Order Change Capabilities`

WP06 must explicitly depend on:

`WP05 Part 2 COMPLETE`

If partial WP06 code already exists, do not delete it unnecessarily; mark it blocked/inactive until WP05 Part 2 is complete.

## 32. Do Not Overengineer

Do not add without proven need:

- generic BPM engine
- arbitrary expression language
- arbitrary SQL
- JavaScript rules
- nested AST builder
- tenant/branch policy overrides
- policy inheritance
- policy checksums/hashes
- Redis dependency
- event-sourced policy engine
- AI-generated runtime rules
- duplicate workflow-transition policy

## 33. Fulfillment / Address Follow-Up

Current simplified domain direction being discussed:

- `sys_ord_fulfillment_types_cd`
- `org_fulfillment_types_cf`
- `org_order_fulfillments_dtl`
- `org_customer_addresses_mst`
- `org_order_addresses_dtl`

WP05 Part 2 may prepare related operation/field/fact catalog support but must not assume these tables already exist. If absent, add an explicit dependency/task in the implementation plan rather than creating them as a hidden side effect.

## 34. Required Codex Output Before Implementation

Codex must first provide:

### A. Reality Check
Existing reusable tables/services, conflicts, missing pieces, naming differences, security concerns, migration concerns.

### B. Final Reconciled Schema
Exact tables, columns, FK targets, indexes, constraints, seeds, and `sys_wf_profile_ver_mst` changes.

### C. Plan Patch
Exact WP05/WP06 changes to the active v3.0 plan.

### D. Implementation Sequence
Migrations -> services -> APIs -> HQ UI -> tenant UI integration -> tests.

### E. Risks
Especially workflow-profile FK cycles, HQ-vs-tenant project boundaries, immutable publish lifecycle, cache invalidation, hard-coded editability bypasses, legacy mutation writers, role grants, proof-key ownership.

Only after reconciliation should implementation proceed.

## 35. Acceptance Criteria

WP05 Part 2 is complete only when:

1. A published workflow profile version resolves one exact Order Change policy revision.
2. Preferred binding is through `sys_wf_profile_ver_mst.edit_policy_id`, unless real architecture requires a justified equivalent.
3. Missing policy fails closed.
4. Missing capability fails closed.
5. `EDIT_ACCESS` blocks entry when denied.
6. `CHANGE_OPERATION` independently governs changes.
7. WARN supports acknowledgment/reason.
8. OVERRIDE requires proper permission/reason.
9. DENY cannot be bypassed.
10. AND/OR is deterministic.
11. Most restrictive decision wins.
12. Approved DB-column facts work without arbitrary SQL.
13. Derived/calculated facts remain domain-owned.
14. Preview re-evaluates.
15. Apply re-evaluates under authoritative concurrency boundary.
16. Policy change after Preview safely requires re-review.
17. Published policies are immutable.
18. Published workflow profile versions cannot silently switch policy.
19. HQ-only mutation security is enforced.
20. EN/AR messaging works.
21. Audit exists.
22. Tenant isolation passes.
23. No N+1 evaluator behavior.
24. Legacy commercial mutation bypasses remain tracked for cutover/WP17.
25. Active v3.0 plan blocks WP06 until WP05 Part 2 completes.

## 36. Final Architecture

```text
                    HQ SEEDED CATALOGS
  operations / decisions / targets / fields
  fact source types / facts / condition types / operators
                         |
                         v
             sys_wf_edit_policy_mst
                         |
                         v
             sys_wf_edit_policy_cap_cf
                         |
                         v
          sys_wf_edit_policy_cap_rule_cf
                         |
                         v
          sys_wf_edit_policy_cap_cond_cf
                         ^
                         |
                  edit_policy_id
                         |
              sys_wf_profile_ver_mst
```

Runtime:

```text
Click Edit
  -> hard checks / feature / RBAC
  -> resolve workflow profile version
  -> resolve pinned Edit policy
  -> EDIT_ACCESS
       DENY -> show message and STOP
  -> open Edit workspace
  -> CHANGE_OPERATION evaluation
  -> Preview
  -> re-evaluate
  -> Apply
  -> OCC/lock + re-evaluate
  -> commit auditable Order Change
```

## Final Project-Owner Direction

CleanMateX Order Edit must use a reusable HQ-controlled Order Change capability policy pinned to the workflow profile version.

The policy must separately control entry into Edit mode and individual Change operations.

HQ may use approved business fields/facts, approved DB-column facts, derived facts, and calculated facts.

No arbitrary SQL/JavaScript/free-form expressions in V1.

Published policies and published workflow profile versions are immutable/pinned.

The engine remains fail-closed.

Codex must reconcile this design with the real codebase, update the active v3.0 implementation plan, and complete WP05 Part 2 before WP06.
