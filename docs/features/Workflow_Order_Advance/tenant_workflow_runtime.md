# Historical tenant runtime — pinned workflow graph (P0)

**Repo:** `cleanmatex` (tenant app)  
**Date:** 2026-08-15; historical status clarified 2026-08-21
**Related HQ plan:** `cleanmatexsaas/.cursor/plans/workflow_profile_policy_runtime_20260821.plan.md`
**Related HQ model:** `cleanmatexsaas/docs/features/SAAS_Platform_Management/Workflow_Engine_HQ/P0_compiled_profile_runtime_model.md`  
**Schema:** migrations `0453` (graph pin), `0454` (unpublish), `0456` (force full graph rebuild on every publish) — apply in cleanmatex; user-owned

---

> **Historical P0 canary record:** Graph-pin execution was retired on 2026-08-22. Profile-stamped orders now require a compiled semantic artifact; the engine, floor lists, Workboard, and new-order paths no longer load `sys_wf_graph_def_ver_mst` at runtime. This file remains the audit record of the P0 pin. Unsnapshotted legacy orders still use live catalogs. No new work may extend this graph-pin approach.

## Why

If the tenant engine always reads **live** `sys_wf_*` catalogs, an HQ edit to a transition/gate/initial rule can silently change in-flight and newly created V2 orders. That is not audit-safe.

At **profile publish**, HQ freezes:

1. An immutable **global graph def** (`sys_wf_graph_def_ver_mst`) — statuses, screens, memberships, actions, transitions, action-maps, gates, initial rules, system screen contracts + fingerprint/checksum  
2. A **profile overlay** on the published version — enabled screens, capabilities, fulfilment policy  

Orders store only `wf_profile_id` + `wf_version_no`. Runtime must load the pinned graph through that pin.

---

## What changed (code)

| File | Role |
|------|------|
| `web-admin/lib/services/workflow/pinned-workflow-graph.service.ts` | **New.** Load graph JSON by profile version pin; helpers for membership + action transitions from pinned data |
| `web-admin/lib/services/workflow/workflow-engine.service.ts` | V2 orders (`wf_profile_id` + `wf_version_no`) use pinned memberships/transitions for list/execute; legacy / unpinned still use live `sys_wf_*` |
| `web-admin/lib/services/workflow/initial-status-resolver.service.ts` | Optional `wfProfileId` / `wfVersionNo`; when set, resolve initial status from pinned `initial_rules` |
| `web-admin/lib/services/order-service.ts` | Resolve profile binding **before** initial-status; pass profile/version into create workflow state so pinned rules apply on create |

**Not changed here:** Workboard UI, stage queue pages, nav/RBAC seeds, HQ APIs, billing/plans/feature flags.

---

## Unpublish → edit → republish

HQ may **unpublish** a `PUBLISHED` version back to `DRAFT` (`POST .../versions/:n/unpublish`) after migration **0454**:

1. Unpublish is allowed even if active tenant assigns remain. Assigns stay, but runtime/create that require a **PUBLISHED** version will not use this version until republish.  
2. Unpublish clears `published_at` / `published_by` / `published_policy_at` but **keeps** `wf_graph_def_version_id` + overlay until republish.  
3. Edit the draft in Profile Studio (save draft as usual).  
4. **Publish** again — **always** inserts a new `sys_wf_graph_def_ver_mst` row (full catalog snapshot) and re-pins the profile version. Fingerprint match does **not** reuse an old graph def.  

Tenant loader resolves pin by `profile_id` + `version_no` for `PUBLISHED`, `DRAFT`, or `RETIRED` so in-flight orders keep the last pin while the version is draft. **Republishing the same version_no replaces the pin** with the new graph def row — prefer clone for immutable history if orders already use that version.

---

## Runtime flow

```text
Order create (V2 assign exists)
  → resolveWorkflowProfileBinding (profile + version)
  → resolveInitialStatus({ ..., wfProfileId, wfVersionNo })
       → loadPinnedGraphForProfileVersion
       → match pinned initial_rules (else fallback status)
  → persist order.wf_profile_id / wf_version_no

listAvailableActions / executeAction
  → load order (includes wf_profile_id, wf_version_no)
  → if both set and graph def pin exists:
       use pinned screen_status_memberships + action_maps/transitions
    else:
       live sys_wf_screen_status_cd + sys_wf_action_trans_cd (+ joins)
  → gates still evaluate live order/finance state (not frozen balances)
```

### Load path

`loadPinnedGraphForProfileVersion(profileId, versionNo)`:

1. Read `sys_wf_profile_ver_mst` for that profile/version (`PUBLISHED`) → `wf_graph_def_version_id`  
2. Read `sys_wf_graph_def_ver_mst` → `graph_definition` JSONB  
3. Return `null` if pin missing (engine falls back to live catalogs)

---

## What is pinned vs live

| Artifact | Source at runtime (V2 pinned order) |
|----------|-------------------------------------|
| Screen ↔ status membership | Pinned graph |
| Actions / transitions / action-maps | Pinned graph |
| Initial status rules | Pinned graph |
| Gates **definitions** | Present in graph snapshot; **evaluation** uses live order fields (rack, prep, balances, etc.) |
| RBAC / permissions | Live |
| Financial balances / invoices | Live |
| Tenant screen-contract overrides | Live (system contracts are in snapshot; tenant overrides not frozen in this slice) |

---

## Preconditions / ops

1. Apply migration **0453** in cleanmatex, then regenerate types in HQ if needed.  
2. **Republish** any profile version published before 0453 — those lack `wf_graph_def_version_id`; HQ assign will reject unpinned published versions.  
3. New publishes from HQ Studio create or reuse a graph def by catalog fingerprint and pin it on the profile version.

---

## Fallback rules

| Order shape | Behavior |
|-------------|----------|
| Has `wf_profile_id` + `wf_version_no` and pin exists | Pinned graph path |
| Has profile/version but pin missing / load fails | Falls back to live `sys_wf_*` (legacy-safe; prefer republish) |
| No profile snapshot (historic / legacy) | Live catalogs only |

Do **not** auto-backfill historic orders onto a new pin.

---

## Verification (smoke)

1. Publish a profile version from HQ Studio after 0453.  
2. Confirm `sys_wf_profile_ver_mst.wf_graph_def_version_id` is set and graph row exists.  
3. Assign tenant → create order → row has `wf_profile_id` / `wf_version_no`.  
4. Change a live transition in HQ catalogs **without** republishing the profile.  
5. Existing V2 order’s available actions still follow the **pinned** graph (not the live edit).  
6. New publish of the profile (new version or same flow per product rules) pins a new/reused fingerprint for **new** orders only.

---

## Related

- HQ developer guide: `cleanmatexsaas/docs/features/SAAS_Platform_Management/Workflow_Engine_HQ/developer_guide.md`  
- HQ APIs (validate / publish-preview / draft): `.../Workflow_Engine_HQ/apis.md`  
- ADR profiles: [ADR_SYS_WF_PROFILES.md](./ADR_SYS_WF_PROFILES.md)  
- Engine service: `web-admin/lib/services/workflow/workflow-engine.service.ts`
