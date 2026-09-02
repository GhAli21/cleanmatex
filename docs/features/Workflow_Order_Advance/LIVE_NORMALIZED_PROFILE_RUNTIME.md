# Live Normalized Workflow Profile Runtime - Tenant Contract

This tenant contract implements HQ ADR-SAAS-MNG-0010
(`cleanmatexsaas` `docs/features/SAAS_Platform_Management/ADRs/ADR-SAAS-MNG-0010_Live_Normalized_Workflow_Profile_Runtime.md`).
Vocabulary: [future_work_in_wf/00_WF_ENTITY_GLOSSARY.md](future_work_in_wf/00_WF_ENTITY_GLOSSARY.md).

## Service split

`WorkflowPolicyResolver` is the **only** tenant policy loader. HQ
`WorkflowPolicyValidator` authors/checks policy; the tenant must not grow a
second Check-policy engine. The DB helper `sys_wf_prof_ver_validate_live` is
integrity-only. Check-policy issue metadata lives in the HQ catalog
([generated/GENERATED_WF_POLICY_ISSUE_CATALOG.md](generated/GENERATED_WF_POLICY_ISSUE_CATALOG.md)).
Add/update/retire codes in HQ after loading `/manage-wf-policy-issues-catalog`;
do not hand-edit the tenant pin. Tenant uses `seed_must_pass` for platform seed CI.

Floor worklists, Workboard, available-actions, command execution, pickup,
delivery, and public tracking consume this resolver. Workboard grouping uses
`wf_profile_version_id` (plus `policy_revision` while the version is Pilot),
not `wf_profile_artifact_id`.

## Runtime rule

For every operational order command, `WorkflowPolicyResolver` loads the order's
stored `wf_profile_id`, `wf_profile_version_id`, and `wf_version_no` from
normalized profile-version tables. It returns module ownership, executable
actions/channels/gates, initial rules, operational switches, and fulfilment
evidence requirements. The result is server-derived and tenant-scoped.

The resolver must not read compiled artifacts, graph pins, templates, action
maps, **legacy** screen contracts / action maps / historical screen-status
memberships, or global catalog rows as policy fallback. Live
`sys_wf_prof_ver_mod_st_cf` rows **are** policy (owner/observer visibility).

Cache only immutable **Published** policy keyed by version id + `policy_revision`,
and only if profiling proves it is required. **Pilot must not** use a stale cache.

Incomplete or inconsistent binding fails closed with stable `PROFILE_*` errors
mapped to 4xx plus EN/AR empty/blocked UI — never a generic 500. Clients never
choose destination status. Channel is derived server-side from the
endpoint/credential; a client-supplied channel cannot escalate.

## Assignment and live-order rule

Changing a tenant profile assignment changes only orders created afterwards.
Existing orders keep `wf_profile_id`, `wf_profile_version_id`, and
`wf_version_no`, including an order that is currently awaiting QA, packing,
pickup, or delivery. Therefore a tenant that switches from a QA profile to a
non-QA profile does not bypass QA for existing orders.

Pilot versions are editable for controlled end-to-end testing (`is_hq_test_demo`
tenants only). An edit applies to test orders already bound to that Pilot
version. Published versions remain locked by database immutability; production
changes require a new version and a new-order assignment.

## Ownership and fulfilment rule

An ordinary stage action may execute only on its source-status owner. The narrow
V1 exception is direct counter pickup: `pickup_handover` may execute
`CONFIRM_PICKUP` from observed `ready` to `delivered` only when the profile
explicitly declares that observer membership, the direct pickup edge, and
`allow_direct_counter_pickup`. Pickup remains `primary_owner` of `ready_for_pickup`. The command must use the same
locked collection, evidence, fulfilment, order transition, audit, and
idempotency transaction as staged pickup. Observers never receive general
execution rights. Workboard (`module_mode = observer`) never executes.

`public_tracking` may execute public OFD `CONFIRM_DELIVERY`. Released customer
pickup still runs `pickup_handover` via the pickup service. Do not bind
`CONFIRM_PICKUP` onto `public_tracking`.

Partial pickup or delivery is enabled only when the corresponding stage-owned
service can atomically validate selected pieces, financial/evidence gates,
fulfilment records, status transition, and audit. A configured but unavailable
partial service fails policy validation; it is never ignored at runtime.

Ready list / Pickup desk remain host aliases of `/dashboard/ready` (see
glossary §1.1). Confirm pickup still opens Ready Details.

## Service rule

No screen, mobile application, public page, or integration writes workflow
status directly. Stage-owned command services remain the only writers and use
the resolved live policy plus transaction-locked order facts. Future Nest
adapters call those same services; they do not grow a second resolver.

Legacy action maps, screen contracts, templates, and catalog transition mappings
may only be consumed by HQ's explicit starter-template import. They are not
tenant runtime fallback data.

## Migration gate

**0470 is applied** locally and remotely (`live_normalized_workflow_profile_runtime`), plus follow-up `0471`. Types have been regenerated.

Runtime loads **live normalized profile-version rows**. Artifact columns on orders are historical audit only and are not written for new orders. `WorkflowPolicyResolver` is the tenant policy loader; `sys_wf_prof_ver_validate_live` remains integrity-only for Pilot/Publish/assignment.

The helper allows only `pickup_handover` / `CONFIRM_PICKUP` / observed `ready` → `delivered`, and rejects other observer executes. Coverage: `web-admin/__tests__/db-integration/wf-prof-ver-validate-live.db.test.ts`.

Do not edit applied 0470. Further schema changes use a later sequence. Agents never apply migrations. Workboard grouping, delivery fail-closed, public-tracking HTTP mapping, verified POS `pos` on pickup/intake/delivery, privacy-safe observe events, and live-runtime unit/source-scan assurance are in. Remaining: S10 canary, soak, apply reviewed `scripts/workflow/local_demo_wf_v2_simple_assign.sql` on local DB if needed, and compiler-retirement docs.
