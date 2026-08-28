---
name: Live Workflow Profile Runtime - Tenant Delivery
overview: Review-first tenant delivery plan for the direct normalized profile-version runtime defined by HQ ADR-SAAS-MNG-0010. It replaces compiled-artifact reads while preserving order version binding, stage-owned services, tenant isolation, finance, gates, fulfilment, audit, and idempotency.
status: awaiting_plan_review
depends_on:
  - F:\jhapp\cleanmatexsaas\.cursor\plans\workflow_live_profile_runtime_20260827.plan.md
  - F:\jhapp\cleanmatexsaas\docs\features\SAAS_Platform_Management\ADRs\ADR-SAAS-MNG-0010_Live_Normalized_Workflow_Profile_Runtime.md
todos:
  - id: lwpr-tenant-governance
    content: Confirm the shared direct-live-policy contract, order-version binding, lifecycle, and no-fallback rules.
    status: completed
  - id: lwpr-tenant-schema
    content: Correct, review, and apply the forward-only shared-schema cutover migration only after this plan and the coordinated application release are approved; 0470 must support the explicit direct-counter pickup observation exception before application.
    status: pending
  - id: lwpr-tenant-baseline
    content: Define and prove complete catalog, starter-profile, test-demo assignment, and read-only preflight baseline data before acceptance testing.
    status: pending
  - id: lwpr-tenant-resolver
    content: Implement the tenant-scoped normalized WorkflowPolicyResolver and policy row mapper with fail-closed behavior.
    status: pending
  - id: lwpr-tenant-order-binding
    content: Update new-order resolution and initial-status selection to persist only the direct profile/version binding.
    status: pending
  - id: lwpr-tenant-command-cutover
    content: Move workflow context, action listing, command execution, worklists, pickup, delivery, public tracking, mobile, and integrations to the resolver.
    status: pending
  - id: lwpr-tenant-api-security
    content: Document and enforce versioned contracts, request validation, server-derived tenant/channel, idempotency, optimistic concurrency, public-token boundaries, and integration safety.
    status: pending
  - id: lwpr-tenant-observability
    content: Add privacy-safe resolver/command telemetry, metrics, alert ownership, and a support runbook.
    status: pending
  - id: lwpr-tenant-assurance
    content: Prove tenant isolation, lifecycle, gates, evidence, payments, concurrency, idempotency, and no artifact fallback with automated tests.
    status: pending
  - id: lwpr-tenant-progress
    content: After every completed implementation step, update this plan and the paired HQ plan with status, evidence, changed contracts, validation results, risks, and the next concrete action.
    status: pending
  - id: lwpr-tenant-docs-per-phase
    content: Create or refresh tenant and coordinated HQ documentation after each verified phase, including runtime contract, APIs, permissions, UI, testing, deployment, risks, rollout, and current status.
    status: pending
  - id: lwpr-tenant-docs-final
    content: As the final completion task, load and use the documentation skill to audit, create, refresh, cross-link, and verify the complete canonical workflow documentation pack with no stale compiled-runtime claims.
    status: pending
---

# Live Normalized Workflow Profile Runtime - Tenant Implementation Plan

## 1. Purpose And Approval Boundary

This is the tenant-application half of the direct normalized workflow profile
runtime. It implements [ADR-SAAS-MNG-0010](F:/jhapp/cleanmatexsaas/docs/features/SAAS_Platform_Management/ADRs/ADR-SAAS-MNG-0010_Live_Normalized_Workflow_Profile_Runtime.md).

No additional implementation task in phases 2 through 12 starts until the
product owner reviews and approves this plan together with the HQ plan. The
existing 0470 migration is a review draft only; this plan never authorizes its
execution, which remains the product owner's normal Supabase workflow.

### 1.1 Cross-Project Execution Order

This is not an HQ-first or tenant-first delivery. It is a coordinated sequence:

1. **Joint contract freeze:** approve both plans/ADR, the issue taxonomy,
   direct-counter pickup exception, API contracts, baseline seed, and preflight
   requirements.
2. **Tenant-owned shared schema:** correct/review `0470`, add its database
   allow/reject tests, then the product owner applies it locally and regenerates
   types in both repositories. No application assumes the new schema before it.
3. **Coordinated build streams:** HQ implements policy authoring, validation,
   lifecycle, assignment, and starter-template import while tenant implements
   the direct resolver, order binding, and stage-owned policy consumers against
   the agreed contract. Neither stream is released independently.
4. **Vertical slice completion:** HQ creates a valid Pilot and assignment; the
   tenant creates and operates orders through the same live-policy contract.
5. **Cross-project acceptance:** verify lifecycle, order binding, direct/staged
   pickup, delivery, finance/evidence gates, idempotency, tenant isolation,
   assignment impact, and no legacy fallback.
6. **Coordinated release:** deploy both applications to staging, complete
   acceptance, then the product owner applies `0470` remotely during the
   approved release window and both plans record evidence.

Do not finish HQ Studio without a tested tenant consumer, and do not cut tenant
runtime over until HQ can create and validate a complete usable policy.

## 2. Fixed Decisions

| Decision | Tenant runtime rule |
|---|---|
| Runtime policy authority | Read normalized profile-version rows only. |
| Order policy binding | Persist `wf_profile_id`, `wf_version_no`, and `wf_profile_version_id` at order creation. |
| Assignment changes | Affect new orders only. Existing orders never silently change profile/version. |
| Pilot behavior | Pilot edits affect test/demo orders already bound to that Pilot version. |
| Published behavior | Published policy is immutable. A change requires a new version. |
| Profile policy consumption | Only server-side stage services resolve and interpret policy. |
| Legacy rows | Never runtime fallback. Historical rows may be used only by HQ's explicit starter-template import. |
| Artifact data | Historical audit only during development; no tenant runtime may read it as policy authority. |
| Existing P0 orders | Historical development data. Orders without a valid direct profile binding fail closed for workflow commands. |
| Open-order migration | Separate future command with preview, validation, confirmation, audit, and idempotency. |

## 3. Runtime Boundary And Service Ownership

### 3.1 One Resolver

Create a server-only `WorkflowPolicyResolver` under
`web-admin/lib/services/workflow/`. It receives a tenant-scoped, already
resolved order binding and returns a typed policy projection. It is the only
tenant component allowed to load module ownership, visible statuses, actions,
channels, gates, initial rules, and fulfilment-evidence requirements.

The resolver must:

- query the order with `tenant_org_id` and use the active transaction when
  called by a command;
- use the order's stored `wf_profile_version_id`, with profile/version values
  checked for consistency;
- read only active normalized rows belonging to that version;
- return deterministic ordering from `display_order` plus stable tie-breakers;
- fail closed with stable safe errors for missing/incomplete policy;
- never query artifacts, templates, graph pins, action maps, screen contracts,
  legacy screen rows, or global catalog rows as a fallback; and
- cache only immutable Published policy by version/revision if profiling proves
  it is required. Pilot policy cannot use a stale cache.

### 3.2 Server-Owned Commands

Screens, public pages, mobile, POS, integrations, and future Nest adapters call
a stage-owned service or API. They submit intent/evidence, not a target status.
The server resolves policy, locks tenant order facts, evaluates gates, executes
finance/fulfilment coordination, writes audit/outbox records, then commits the
status change atomically.

No client or third party may choose destination status, update
`org_orders_mst.status` directly, bypass collection/evidence/gates, or infer
actions from a screen name or catalog fallback.

## 4. Data Model And Migration Plan

### 4.1 Direct Authority Tables

| Policy concern | Direct table |
|---|---|
| Version lifecycle/revision | `sys_wf_profile_ver_mst` |
| Version operational switches | `sys_wf_prof_ver_policy_cf` |
| Enabled modules/screens | `sys_wf_prof_ver_module_cf` |
| Owner/observer visibility | `sys_wf_prof_ver_mod_st_cf` |
| Executable actions | `sys_wf_prof_ver_exec_cf` |
| Caller channels | `sys_wf_prof_ver_exec_ch_cf` |
| Gate bindings | `sys_wf_prof_ver_exec_gate_cf` |
| Initial-status rules | `sys_wf_prof_ver_init_cf` |
| Pickup/delivery evidence | `sys_wf_prof_ver_evidence_cf` |
| New-order assignment | `org_wf_profile_assign_cf` |
| Order binding | `org_orders_mst` profile/version fields |

### 4.2 Forward Migration

Review [0470_live_normalized_workflow_profile_runtime.sql](F:/jhapp/cleanmatex/supabase/migrations/0470_live_normalized_workflow_profile_runtime.sql) before it is applied. It:

- removes compiled-artifact completeness requirements from active orders;
- keeps direct profile/version/order binding complete;
- validates Pilot, Published, and assigned versions from relational policy rows;
- retains strict lifecycle and Published immutability;
- restricts Pilot assignment to `org_tenants_mst.is_hq_test_demo = true`;
- allows partial pickup/delivery switches to be configured; and
- keeps historical artifact rows non-destructively for audit only.

Do not drop artifact rows/columns in this phase. Physical retirement is a later
maintenance migration after development data recreation and proof that no
application consumer remains.

### 4.3 Migration Review Checks

1. Verify altered objects locally and remotely.
2. Classify active development orders without a direct binding as historical,
   or repair them through an approved data plan.
3. Verify no migration uses `CASCADE`.
4. Confirm constraint names against the applied schema.
5. **Before applying 0470:** correct the relational ownership guard so it allows
   only `pickup_handover` / `CONFIRM_PICKUP` from observed `ready` when the
   direct-counter edge is explicitly configured. It must reject all other
   observer execution attempts. Add database integration coverage for both
   allow and reject cases.
6. Re-review every `sys_wf_prof_ver_validate_live` rule against
   `01_HQ_STUDIO_VALIDATION_GAPS.md` and the HQ issue-code specification. The
   DB helper remains a minimal integrity guard; it must not recreate a compiler
   or become the detailed policy validator.
7. Apply local first, regenerate types, run tenant/HQ tests, then apply remote
   in the approved release window.
8. Record version, timestamp, and test evidence in both `current_status.md` files.

## 5. Phase 0 - Operational Baseline, Seed, And Preflight

### 5.1 Baseline Data Ownership

The database schema alone cannot make a profile executable. Before assigning a
Pilot or Published version, maintain a complete, reviewable baseline for:

- active workflow status, screen, action, gate, and initial-rule catalog rows;
- typed gate evaluator support and allowed channel codes;
- a recommended laundry starter policy represented as normalized profile rows;
- evidence method catalog/configuration supported by pickup and delivery;
- a dedicated `is_hq_test_demo = true` tenant, test branch where applicable,
  test customer, and non-production payment/delivery provider setup; and
- an explicit active tenant assignment for the selected Pilot profile version.

No runtime service seeds data implicitly. HQ supplies a deliberate starter
template/example; shared reference data is created only through reviewed,
idempotent migration or seed scripts owned by the tenant repository.

### 5.2 Preflight Command And Acceptance Evidence

Design a read-only `workflow-policy-preflight` service/script that receives a
tenant, branch, service scope, and profile version. It reports, without mutating
data:

- assignment winner and specificity;
- lifecycle/test-demo eligibility;
- validator findings and missing policy sections;
- source/order-status/action/channel compatibility;
- required payment, rack, route/stop, and evidence capabilities; and
- whether the configured starter baseline is ready for end-to-end testing.

It must never leak another tenant's assignment/order data. A completed preflight
report, generated type version, and baseline profile/version identifiers are
required release evidence before acceptance testing begins.

## 6. Phase 1 - Tenant Resolver

### Files Expected To Change

- `web-admin/lib/services/workflow/workflow-policy-resolver.service.ts` - new direct normalized loader.
- `web-admin/lib/services/workflow/workflow-policy.types.ts` - shared typed projection/errors if required.
- `web-admin/lib/services/workflow/workflow-profile-resolution.service.ts` - assignment-only new order resolution; remove artifact lookup.
- `web-admin/lib/services/workflow/initial-status-resolver.service.ts` - direct initial-rule selection.
- Focused workflow unit tests in the existing test location.

### Required Resolver Projection

- profile/version/version-id/lifecycle/policy revision;
- enabled modules and module role;
- owner/observer status memberships;
- action edges with source/destination, channels, reason/evidence/concurrency/idempotency requirements, and gate bindings;
- deterministic initial rules;
- operational switches; and
- ordered pickup/delivery evidence requirements.

Ordinary stage commands require the executing module to own the source status.
The only V1 fulfilment exception is direct counter pickup: `pickup_handover` may
execute `CONFIRM_PICKUP` from `ready` only when it has explicit observer
membership for `ready`, the configured direct-pickup edge is present, and the
same locked collection/evidence/audit transaction is used. Observer membership
does not generally grant execution authority.

`parameters_json` is typed gate configuration only. It is never an executable
workflow or a replacement for normalized policy rows.

### Acceptance Criteria

- Incomplete policy fails closed without mutation.
- No order resolves a policy from another tenant's order.
- Output is deterministic.
- Pilot reads reflect committed edits without compilation.
- Published policy cannot mutate through tenant code.
- Production resolver code has no artifact table read.

## 7. Phase 2 - New-Order Binding And Initial Status

1. Validate request and service-category scope.
2. Resolve most-specific active assignment by tenant, optional branch, and service category.
3. Allow Published, or Pilot only for HQ test/demo tenants.
4. Load normalized initial rules and choose exactly one matching rule.
5. Reject ambiguity.
6. Persist direct profile/version/version-id and initial status in the same transaction.
7. Write existing order audit/outbox records.

If service-scoped assignments resolve different versions, reject one combined
order and require split orders. Never select the first item arbitrarily.

Remove artifact id/checksum/schema as required resolver output and stop writing
artifact fields for newly created orders after 0470. Cover staff, POS, quick
drop, API/import, and future mobile intake.

## 8. Phase 3 - Stage Service And API Cutover

| Consumer | Required cutover |
|---|---|
| Workflow context | Project direct module visibility. |
| Available-actions API | Return policy-owned edges for current status/channel only. |
| Command engine | Resolve action edge server-side before gates and mutation. |
| Floor stages | Preparation, Processing, Assembly, QA, Packing, Ready use configured actions only. |
| Workboard/worklists | List by policy ownership/status membership, never global template. |
| Pickup | Resolve release, collection, evidence, and partial-pickup policy. |
| Delivery | Resolve POD, collection, route/stop, and partial-delivery policy. |
| Public tracking | Use public-only policy channel plus token authorization. |
| Mobile/POS/API/integrations | Reuse stage services with declared caller channel. |
| Audit/history | Display profile/version/action decision metadata without artifact authority. |

Every `org_*` query filters `tenant_org_id`. Routes validate input, establish
actor/tenant context, and delegate to a service.

## 9. Phase 4 - Gates, Finance, And Fulfilment

Existing gate services remain the only evaluator. The resolver supplies action
gate bindings; evaluator uses locked current order facts.

- `hard_block` denies execution.
- `soft_warning`/`override_allowed` remain unavailable until their evaluator,
  permission, acknowledgement/override reason, and audit behavior exist.
- Gate failure never creates partial payment, proof, fulfilment, or status change.

Financial collection stays in financial services. Workflow calls the dedicated
collection-blocking evaluator. B2B currently returns non-blocking by default;
B2B credit/settlement belongs to its own future domain implementation.

Pickup/delivery must atomically validate status, policy, collection, evidence,
piece subset (when partial), fulfilment record, order change, and audit. Direct
`ready -> delivered` is valid only with an explicit configured/gated action.

## 10. Phase 5 - Retire Artifact Runtime

After direct policy consumers are tested, remove or convert to historical-only:

- artifact fetch/cache behavior in `semantic-workflow-artifact.service.ts`;
- artifact fields in resolver/new-order payloads;
- artifact parsing in delivery/pickup services;
- artifact checks in workflow context, action listing, worklists, command execution;
- artifact-specific runtime errors.

Do not rename a legacy service and leave its old behavior. Replace it with direct
policy or delete it after all imports/tests are removed.

Required repository audit: no operational runtime read of artifact tables,
artifact/checksum metadata, graph pins, runtime templates, action maps, screen
contracts, or legacy memberships. Historical reporting may reference them only
as clearly labeled audit/template-import data.

## 11. Phase 6 - API Contracts, Integration Safety, And Security

Every tenant route keeps an explicit versioned API contract. For each direct
policy endpoint and stage command, document request schema, response schema,
stable error codes, caller channel, required actor context, idempotency rule,
permission/access contract, rate-limit posture, and audit event.

- Validate all external input with Zod at the route boundary.
- Derive tenant and actor from authenticated server context, never body/query
  values. Every `org_*` query filters `tenant_org_id`.
- Derive the channel server-side from the endpoint/credential; reject client
  supplied channel escalation.
- Require idempotency keys for commands configured as idempotent and store/replay
  the original safe response for equivalent retries.
- Use optimistic order state version checks for status-changing commands.
- Apply authenticated permission checks for staff, POS, integration, and mobile
  callers. Public tracking is token-scoped, action-limited, data-minimized, and
  separately rate-limited.
- Integration adapters verify signature/authentication, use bounded retries and
  outbox/event delivery, deduplicate incoming commands, and never call database
  tables directly.
- Define backward-compatible response evolution. A breaking API change requires
  a new `/api/vN` contract and consumer migration, never a silent field change.

## 12. Phase 7 - Observability, Support, And Operations

Add structured, privacy-safe observability to each resolver and command path.
Every log/audit/outbox event includes correlation id, tenant id, order id where
available, bound profile/version id, policy revision, action code, channel,
gate result, fulfilment/payment decision, outcome, and latency. Do not log
tracking tokens, raw proof media, payment details, or customer PII beyond the
existing approved audit identifiers.

Create measurable counters/timers for policy resolution, validation failure,
no-assignment failure, denied gate, idempotent replay, state conflict, pickup
completion, delivery completion, and public tracking rejection. Define alert
thresholds and owners for sustained policy-resolution failures, unusual
cross-tenant rejection, command rollback, and outbox retry backlog.

Create a support runbook covering safe diagnosis by correlation/order/profile
version, assignment replacement for new orders, Pilot rollback, blocked gate
remediation, incident evidence preservation, and explicit escalation when an
open-order migration would otherwise be requested. Support must never edit an
order status directly.

## 13. Phase 8 - Test Matrix

### Unit

- assignment specificity/conflict;
- Published/Pilot eligibility and test-demo enforcement;
- module/status/action/channel mapping;
- owner versus observer authority;
- direct counter pickup from observed `ready` is allowed only for
  `pickup_handover` / `CONFIRM_PICKUP`, while ordinary observer execution is
  rejected;
- initial-rule priority/ambiguity;
- incomplete-policy fail-close;
- Pilot live edit and Published stability;
- no artifact fallback.

### Database Integration

- active assignment requires valid relational Pilot/Published policy;
- active order direct binding completeness;
- tenant/profile/version binding integrity;
- Published immutability;
- Pilot rejected for non-test/demo tenant;
- policy revision conflict;
- no cross-tenant access path.

### Workflow Integration

- standard preparation through pickup/delivery;
- QA and no-QA profiles applied to distinct new orders;
- assignment replacement leaves old order behavior unchanged;
- payment blocking/retry;
- required evidence block/allow;
- configured partial pickup/delivery valid/invalid subsets;
- public tracking policy/token scope;
- duplicate idempotency key does not duplicate money/proof/audit;
- state race is conflict with no partial mutation.

Required verification:

```powershell
cd F:\jhapp\cleanmatex\web-admin
npx eslint . --quiet
npm run typecheck
npm run check:i18n
npm run test:db-integration -- <affected-test-file>
npm run build
```

Record confirmed exit status only.

## 14. Phase 9 - Release And Rollback

1. Approve both plans and ADR-0010.
2. Correct/review 0470's direct-counter pickup guard and add its database tests.
3. Apply 0470 locally.
4. Regenerate types in both repositories.
5. Deploy HQ direct policy APIs and tenant readers together to local/staging.
6. Seed/import a complete Pilot profile, assign it to an HQ demo tenant, and run acceptance.
7. Deploy applications and apply 0470 remotely in the approved window.
8. Monitor policy errors, gates, order creation, and commands.
9. Retire artifact runtime only after evidence confirms direct runtime authority.

Migration is forward-only. For defects, deactivate/replace assignment with a
known valid Published version for new orders; halt unsafe stage action only if
it does not strand orders; retain logs/policy/order/actor evidence; correct
forward via reviewed code/migration. Do not delete normalized or artifact data.

## 15. Documentation And Governance

### 15.1 Mandatory Update After Every Step

Before starting the next implementation step, update this plan and the paired
HQ plan with: completed/in-progress/pending status, files and contracts changed,
schema/API/UI impact, commands/tests run with confirmed results, known risks or
blocked decisions, and the next concrete action. Do not mark a task complete
from code review or intention alone.

### 15.2 Documentation After Every Verified Phase

After each verified phase, create or refresh the applicable canonical tenant
and coordinated HQ documents: `README`, `user_guide`, `developer_guide`,
`testing_guide_and_scenarios`, `deploy_guide`, `current_status`,
`progress_summary`, `permissions`, `05_Business_Rules_and_Gates`,
`06_API_Contracts`, `07_Permissions_RBAC_Nav`, `08_UI_UX_Screens`,
`13_Production_Readiness_Checklist`, `risks_and_rollout`, and cross-project ADR
or design references. Mark a genuinely absent surface `N/A`; never omit it.

Document migrations, routes, services, permissions, navigation, i18n, flags,
settings, plan limits, env vars, tests, risks, rollout, and rollback. The final
completion task must load and use the documentation skill to audit the canonical
feature pack, create any missing required documents, cross-link the two
repositories, and verify there are no stale compiled-runtime claims.

## 16. Out Of Scope

- Automatic migration of open orders to another profile version.
- OTP implementation.
- New payment-collection page.
- B2B credit/settlement redesign in workflow services.
- Physical legacy/artifact deletion before an approved data-retention cleanup.
