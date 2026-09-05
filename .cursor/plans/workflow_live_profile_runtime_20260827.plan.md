---
name: Live Workflow Profile Runtime - Tenant Delivery
overview: Review-first tenant delivery plan for the direct normalized profile-version runtime defined by HQ ADR-SAAS-MNG-0010. It replaces compiled-artifact reads while preserving order version binding, stage-owned services, tenant isolation, finance, gates, fulfilment, audit, and idempotency.
status: awaiting_plan_review
depends_on:
  - F:\jhapp\cleanmatexsaas\.cursor\plans\workflow_live_profile_runtime_20260827.plan.md
  - F:\jhapp\cleanmatexsaas\docs\features\SAAS_Platform_Management\ADRs\ADR-SAAS-MNG-0010_Live_Normalized_Workflow_Profile_Runtime.md
extends_with:
  - F:\jhapp\cleanmatex\.cursor\plans\wf_create_hydration_collection_hold_20260903.plan.md
  - F:\jhapp\cleanmatex\docs\features\Workflow_Order_Advance\future_work_in_wf\04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md
relationship: |
  This 20260827 plan remains the live-policy PLATFORM programme (Gates 0–5).
  It is NOT replaced by the 20260903 create-hydration / HOME_COLLECTION / hold plan.
  That later plan builds ON this runtime (init_cf, resolver, Check policy) and adds
  product capabilities. Finish residual Gate 4/5 + assurance here; implement product
  WPs in the 20260903 plan without reopening ADR-0010 architecture.
todos:
  - id: lwpr-tenant-governance
    content: Confirm the shared direct-live-policy contract, order-version binding, lifecycle, and no-fallback rules.
    status: completed
  - id: lwpr-tenant-schema
    content: "0470-0475 applied locally and remotely. Guard allows only pickup_handover CONFIRM_PICKUP from observed ready to delivered. Types regenerated. Do not edit applied 0470-0475."
    status: completed
  - id: lwpr-tenant-baseline
    content: "0472 live policy seed applied locally and remotely. 0475 SIMPLE DRAFT repair applied. Read-only preflight in. HQ Check policy/assign-without-artifact/demote in. Local and remote each have one active assignment."
    status: completed
  - id: lwpr-tenant-profile-level-seed
    content: "0472 applied locally and remotely. 0475 SIMPLE DRAFT repair applied. Live policy v2 (v1 for WF_V2_ROUTED_POD) seeded for laundry business levels. Do not edit 0444/0445/0470-0475."
    status: completed
  - id: lwpr-tenant-resolver
    content: Implement the tenant-scoped normalized WorkflowPolicyResolver and policy row mapper with fail-closed behavior.
    status: completed
  - id: lwpr-tenant-order-binding
    content: Update new-order resolution and initial-status selection to persist only the direct profile/version binding.
    status: completed
  - id: lwpr-tenant-command-cutover
    content: "Workboard, delivery fail-close, 0473 ledger, public-tracking PROFILE_* HTTP mapping, server-derived staff_web/mobile, and verified POS pos on pickup/intake/delivery (OPEN till, no client header). Generic /actions stays credential-only."
    status: completed
  - id: lwpr-tenant-api-security
    content: "Documented live-policy contracts, server-derived tenant/channel, public-token privacy (no rack), PROFILE_* 409, ignored client channel fields, privacy-safe observe events, and the live-runtime support runbook."
    status: completed
  - id: lwpr-tenant-observability
    content: "Privacy-safe wf.* observe events, in-process counters, support runbook (technical_docs/live_runtime_support.md), and 09 observability refresh. Successful policy loads stay DEBUG."
    status: completed
  - id: lwpr-tenant-assurance
    content: "Unit+source-scan live runtime plus HQ Check policy. S10 canary SIGNED 2026-09-05. Gate 5 compiler retirement: evidence audit done 2026-09-05 — zero live readers/writers confirmed on both repos plus live-data check (0/19 profile versions stamped, artifact table has 2 dead rows from 2026-08-27, no callers of commitSemanticProfileArtifact/getCurrentSemanticArtifact in HQ). HQ dead code removed; tenant migration 0494_wf_prof_ver_artifact_retirement.sql drafted, awaiting operator review/apply. Residual: soak, then apply 0494 + regenerate HQ types."
    status: in_progress
  - id: lwpr-tenant-progress
    content: After every completed implementation step, update this plan and the paired HQ plan with status, evidence, changed contracts, validation results, risks, and the next concrete action.
    status: completed
  - id: lwpr-tenant-docs-per-phase
    content: Create or refresh tenant and coordinated HQ documentation after each verified phase, including runtime contract, APIs, permissions, UI, testing, deployment, risks, rollout, and current status.
    status: in_progress
  - id: lwpr-tenant-docs-final
    content: As the final completion task, load and use the documentation skill to audit, create, refresh, cross-link, and verify the complete canonical workflow documentation pack with no stale compiled-runtime claims.
    status: pending
---

# Live Normalized Workflow Profile Runtime - Tenant Implementation Plan

## 1. Purpose And Approval Boundary

This is the tenant-application half of the direct normalized workflow profile
runtime. It implements [ADR-SAAS-MNG-0010](F:/jhapp/cleanmatexsaas/docs/features/SAAS_Platform_Management/ADRs/ADR-SAAS-MNG-0010_Live_Normalized_Workflow_Profile_Runtime.md).

No additional implementation task in phases 2 through 12 starts until the
product owner reviews and approves this plan together with the HQ plan.

**0470 is applied** locally and remotely (`0470` + `0471`). Types are regenerated.
Do not edit applied 0470. Further schema changes use a later sequence. Agents never apply migrations.

### 1.1 Cross-Project Execution Order

This is not an HQ-first or tenant-first delivery. It is a coordinated sequence:

1. **Joint contract freeze:** approve both plans/ADR, the issue taxonomy,
   direct-counter pickup exception, API contracts, baseline seed, and preflight
   requirements.
2. **Tenant-owned shared schema (applied):** 0470 + 0471 are live locally and remotely. Types regenerated. Do not edit applied 0470.
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

### 1.2 Authority And Execution Gates

**Vocabulary:** `docs/features/Workflow_Order_Advance/future_work_in_wf/00_WF_ENTITY_GLOSSARY.md`.
**Runtime law:** `docs/features/Workflow_Order_Advance/LIVE_NORMALIZED_PROFILE_RUNTIME.md`.
**Decision:** HQ ADR-SAAS-MNG-0010 (Accepted). Validator = HQ; resolver = tenant.

Do not execute phases 2–9 as one waterfall. Ship **gates**:

| Gate | Done when |
|------|-----------|
| **0 Contract freeze** | ADR + glossary + both contracts + issue taxonomy + pickup `ready`→`delivered` exception agreed. |
| **1 Schema** | **Done.** 0470 + 0471 applied locally and remotely. Guard allows only pickup_handover CONFIRM_PICKUP from observed ready to delivered. Types regenerated. Do not edit applied 0470. |
| **2 Vertical slice** | HQ: save, Check policy, Pilot, assign demo tenant. Tenant: **business-level live-policy seed migration** (§5.2) + resolver + create (version binding only) + Ready list + Ready Details **staged and direct** `CONFIRM_PICKUP` + collection/evidence atomicity. One demo order proves Pilot edit is visible. No artifact read on that path. Floor UX: `PROFILE_*` → 4xx + EN/AR empty/blocked, Cmx, RTL. |
| **3 Remaining runtime** | Plant floors, **Workboard groups by `wf_profile_version_id`**, delivery, public tracking, worklists. Delete leftover artifact reads as each path is cut. |
| **4 Studio completeness** | Remaining HQ sections, Effective preview = resolver shape, assignment “new orders only.” |
| **5 Retire compiler** | Grep/audit clean. Remote 0470 + both apps in **one** window. |

Starter-template import, observability polish, and open-order migrate stay after Gate 2. Do not enable partial fulfilment on the starter until the atomic piece service is in the slice.

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

### 4.2 0470 is applied

**Fact:** `0470_live_normalized_workflow_profile_runtime` and `0471_fix_sys_wf_prof_ver_commit_art_ambiguous_version_id` are applied locally and remotely. Types are regenerated. Do not edit those files; later schema work uses a new sequence.

`sys_wf_prof_ver_validate_live` **allows** only this tuple when pickup has observer membership for `ready` and `ready_release` remains owner of `ready`: `screen_key = pickup_handover`, `action_code = CONFIRM_PICKUP`, `from_status = ready`, `to_status = delivered`. It **rejects** `CONFIRM_PICKUP` on any other module and every other executable that lacks owner visibility. Coverage: `web-admin/__tests__/db-integration/wf-prof-ver-validate-live.db.test.ts`.

**Gate 2 tenant slice:** resolver, version-only create binding, Ready lists, engine, and pickup read live rows. Direct counter pickup also requires `sys_wf_prof_ver_policy_cf.allow_direct_counter_pickup`. Unbound orders fail closed. **Workboard groups by `wf_profile_version_id`.** **0472** and **0473** are applied locally and remotely. Do not edit those files.

Do not drop artifact rows/columns in this phase. Physical retirement is a later
maintenance migration after development data recreation and proof that no
application consumer remains.

### 4.3 Applied-schema follow-ups

0470/0471 review checks are complete. Remaining data work:

1. Classify active development orders without a direct binding as historical, or repair them through an approved data plan.
2. Keep DB tests for direct-counter **allow** and all other observer-execute **reject**.
3. Do not edit applied 0470/0471. New schema uses a later sequence.
4. Baseline seed and preflight remain Gate 2 blockers for a demo Pilot order.
5. **Business-level live-policy seed** is a dedicated later-seq tenant migration (`lwpr-tenant-profile-level-seed`). Existing `0444`/`0445` headers are not executable live policy.

## 5. Phase 0 - Operational Baseline, Seed, And Preflight

### 5.1 Baseline Data Ownership

The database schema alone cannot make a profile executable. Before assigning a
Pilot or Published version, maintain a complete, reviewable baseline for:

- active workflow status, screen, action, gate, and initial-rule catalog rows;
- typed gate evaluator support and allowed channel codes;
- a recommended laundry starter policy represented as normalized profile rows;
- **complete live policy seeds for multiple laundry business levels** (see §5.2);
- evidence method catalog/configuration supported by pickup and delivery;
- a dedicated `is_hq_test_demo = true` tenant, test branch where applicable,
  test customer, and non-production payment/delivery provider setup; and
- an explicit active tenant assignment for the selected Pilot profile version.

No runtime service seeds data implicitly. HQ supplies a deliberate starter
template/example; shared reference data is created only through reviewed,
idempotent migration or seed scripts owned by the tenant repository.

### 5.2 Business-level live-policy seed migration (planned)

**Why:** Gate 2 cannot prove a demo order while `sys_wf_prof_ver_*` policy rows are empty. `0444` seeded `WF_V2_STANDARD` and `0445` seeded additional **profile headers / screen lists** (`WF_V2_SIMPLE`, `WF_V2_ASSEMBLY_QA`, `WF_V2_PICKUP_DELIVERY`, `WF_V2_OUTSOURCE`, `WF_V2_ISSUE_REPROCESS`). Those files are applied history. They are **not** complete live normalized policy (no `policy_cf` / `module_cf` / `mod_st_cf` / `exec_cf` / channels / gates / init / evidence). Do **not** edit `0444`, `0445`, `0470`, or `0471`.

**Task:** create a **new later-seq** tenant migration, tentatively
`0472_wf_live_policy_business_level_seed.sql` (confirm next seq at write time).
Agents create the SQL file only. The product owner reviews and applies it locally, then remotely. Never apply via MCP/CLI/agent.

**Status (2026-08-28):** `0472_wf_live_policy_business_level_seed.sql` is **applied locally**. Existing PUBLISHED v1 headers stay historical; live policy is version_no = 2 (v1 for new `WF_V2_ROUTED_POD`). The file also restored `sys_wf_prof_cfg_guard` channel/gate `version_id` lookup that 0470 overwrote. Do not edit 0472. Demo assignment is still HQ/explicit; tenant preflight is read-only.

**What to seed:** complete, idempotent live policy for distinct laundry **business levels**, aligned to shop archetypes in `docs/features/Workflow_Order_Advance/future_work_in_wf/01_HQ_STUDIO_VALIDATION_GAPS.md` §6. Reuse existing `WF_V2_*` profile codes where they still match; add a new code only when an archetype has no header.

| Business level | Archetype (file 01) | Profile code to reuse or add | Must include |
|---|---|---|---|
| Small counter shop | Lean plant / counter-only | `WF_V2_SIMPLE` | `processing` + `ready_release` + `pickup_handover`; `CONFIRM_PICKUP` on pickup with `staff_web`; skip Off prep/assembly/QA/packing; `driver_delivery` Off |
| Standard plant | Full floor (no extra QA) | `WF_V2_STANDARD` | Intake → process → Ready → pickup and/or delivery; one primary owner per non-terminal status |
| QA plant | Full floor + assembly/QA | `WF_V2_ASSEMBLY_QA` | Assembly + QA owners; fail/pass edges; skip only Off optional stages |
| Pickup + delivery shop | Lean or full + both fulfilment | `WF_V2_PICKUP_DELIVERY` | Ready hosts pickup and delivery; pickup module owns `CONFIRM_PICKUP`; delivery owns `CONFIRM_DELIVERY` |
| Simple delivery (no stop) | Simple delivery | Reuse `WF_V2_PICKUP_DELIVERY` or a dedicated code if stop-gated policy would pollute it | `driver_delivery` + `CONFIRM_DELIVERY` + `staff_web`; **do not** bind `delivery_stop_active` |
| Routed POD | Routed POD | Dedicated code if needed (do not overload simple delivery) | `delivery_stop_active` + POD evidence methods; no dummy tenant routes |
| Outsource / issue-reprocess | Partner / exception paths | `WF_V2_OUTSOURCE`, `WF_V2_ISSUE_REPROCESS` | Only if catalog actions/gates exist; otherwise document as later seed, do not fake edges |

**Direct counter pickup:** only on levels that truly skip staging. Bind `CONFIRM_PICKUP` on `pickup_handover` from observed `ready` → `delivered`, with `ready_release` still owning `ready`, and set `allow_direct_counter_pickup = true`. Never bind `CONFIRM_PICKUP` on `ready_release` or `public_tracking`. Public confirm still requires a pickup release.

**Seed rules:**

- Upsert with `ON CONFLICT ... DO UPDATE` (or equivalent) so re-runs are safe.
- Write **live** rows: `sys_wf_prof_ver_policy_cf`, `module_cf`, `mod_st_cf`, `exec_cf`, `exec_ch_cf`, `exec_gate_cf`, `init_cf`, `evidence_cf`. Bilingual `name`/`name2` on profile/version headers.
- Each seeded version must pass `sys_wf_prof_ver_validate_live`.
- Prefer **Pilot** on the HQ test/demo path and **Published** only when the version is intended as an immutable starter. Do **not** auto-assign tenants in this migration.
- Demo assignment (`org_wf_profile_assign_cf` for `is_hq_test_demo`) stays a separate reviewed step in `lwpr-tenant-baseline`.
- No `CASCADE`. No runtime service seeds these rows implicitly.
- Partial fulfilment stays Off until the atomic piece service exists.
- Add allow/reject DB tests: at least one lean-counter allow for direct `CONFIRM_PICKUP`, and reject `CONFIRM_PICKUP` on the wrong module.

**HQ:** does not create this migration. After apply, Studio treats these versions as starter-template sources (`Use as starter template` is explicit). Check policy must pass each seeded level before assign.

### 5.3 Preflight Command And Acceptance Evidence

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
2. **0470 + 0471 applied** locally and remotely; types regenerated. Do not edit those files.
3. Seed/import a complete Pilot profile, assign it to an HQ demo tenant, and run Gate 2 acceptance.
4. Deploy HQ direct policy APIs and tenant readers together to staging.
5. Gate 5 remaining work is compiler/artifact retirement and coordinated app release, not a second remote 0470 apply.
6. Monitor policy errors, gates, order creation, and commands.
7. Retire artifact runtime only after evidence confirms direct runtime authority.

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
