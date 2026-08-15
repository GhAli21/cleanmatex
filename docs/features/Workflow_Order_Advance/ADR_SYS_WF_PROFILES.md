# ADR — HQ Workflow Profiles (`sys_wf_profiles_*`)

**Status:** Accepted · migration `0444` applied (local + remote, operator confirmed 2026-08-14)  
**Decider:** Engineering  
**Related:** [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md), [03_ERD_and_Data_Model.md](03_ERD_and_Data_Model.md), HQ pack in `cleanmatexsaas` `Workflow_Engine_HQ/`

## 1. Context

V1.0 shipped:

- Global runtime catalogs `sys_wf_*` (statuses, screens, transitions, actions, gates, initial rules)
- Assignment stub `org_wf_profile_assign_cf` with `wf_profile_id` / `wf_version_no`
- Order snapshot columns `org_orders_mst.wf_profile_id` / `wf_version_no`

**Missing:** the profile master + immutable published versions that those UUIDs/version numbers are supposed to reference. HQ cannot safely publish/assign without inventing orphan IDs. Legacy `sys_workflow_template_*` remains an interim stand-in only.

## 2. Decision

Add **create-only** HQ profile tables in `cleanmatex` (migration `0444_sys_wf_profiles_and_versions.sql`):

| Table (≤30) | Role |
|-------------|------|
| `sys_wf_profiles_cd` | Profile header (`profile_id`, `profile_code`, EN/AR, active) |
| `sys_wf_profile_ver_mst` | Version rows: `DRAFT` / `PUBLISHED` / `RETIRED`; capability flags; optional `based_on_template_id` |
| `sys_wf_prof_ver_scr_dtl` | Per-version enabled `screen_key` list (FK → `sys_wf_screens_cd`) |

Also:

- FK `org_wf_profile_assign_cf.wf_profile_id` → `sys_wf_profiles_cd(profile_id)`
- Composite FK `(wf_profile_id, wf_version_no)` → published/retired versions when `wf_version_no` is not null
- Trigger: **published versions are immutable** except transition to `RETIRED` (+ audit timestamps)
- Seed one system profile `WF_V2_STANDARD` with published `version_no = 1` and core screens enabled
- **Do not** auto-assign all tenants (HQ assigns explicitly)

## 3. What a profile version owns vs does not own (V1.0)

| Owns (profile version) | Does **not** own (stays global `sys_wf_*`) |
|------------------------|-------------------------------------------|
| Lifecycle publish/retire | Status codes |
| Capability toggles (prep/assembly/qa/packing/pieces/split/back-steps) | Transition graph / action maps / gates / initial rules |
| Enabled operational screens for this operating model | Renaming frozen `screen_key` / `action_code` |
| Optional link to legacy template (`based_on_template_id`) | Per-order release runtime (`org_wf_release_*`) |
| Notes / changelog for HQ | |

Rationale: engine already executes from global catalogs. Profiles select **operating shape** (which screens/capabilities a tenant gets) without cloning the full graph per tenant. Richer per-profile graph overlays = V1.2 HQ designer if needed.

## 4. Version lifecycle

```
DRAFT → PUBLISHED → RETIRED
         ↑ clone   (new DRAFT from prior version; never edit PUBLISHED in place)
```

- New orders snapshot `wf_profile_id` + `wf_version_no` at create when assign resolves.
- Retire blocks **new** HQ assigns to that version; open orders keep their snapshot.
- `wf_version_no` null on assign = “resolve latest PUBLISHED for profile at read/create time” (allowed); HQ UI should prefer pinning an explicit version.

## 5. Dual-path with legacy templates

Until cutover completes:

- Legacy tenants may still use `sys_workflow_template_*` + `org_tenant_workflow_*`
- V2 path uses `sys_wf_profiles_*` + `org_wf_profile_assign_cf` + global `sys_wf_*`
- `based_on_template_id` documents lineage only; runtime authority for V2 actions remains `sys_wf_action_trans_cd`

## 5A. Seeded HQ preset catalog

| profile_code | Migration | Intended use | Legacy lineage |
|--------------|-----------|--------------|----------------|
| `WF_V2_STANDARD` | `0444` | Default full floor | `WF_STANDARD` |
| `WF_V2_SIMPLE` | `0445` | Lean / starter / trial | `WF_SIMPLE` |
| `WF_V2_ASSEMBLY_QA` | `0445` | QA-heavy / growth+ | `WF_ASSEMBLY_QA` |
| `WF_V2_PICKUP_DELIVERY` | `0445` | Delivery-oriented | `WF_PICKUP_DELIVERY` |
| `WF_V2_OUTSOURCE` | `0445` | Outsourcing intent (jobs module still V1.2) | `WF_STANDARD` + `config_json.outsourcing_enabled` |
| `WF_V2_ISSUE_REPROCESS` | `0445` | Exception / rework (`allow_back_steps`) | `WF_ISSUE_REPROCESS` |

Hints in `config_json.intended_plans` are **guidance for HQ UI**, not hard plan enforcement (enforcement stays feature-flag / plan mapping elsewhere).  
**No auto tenant assign** — HQ must assign explicitly.

## 6. Consequences

- HQ Phase D (publish/assign) unblocked after migration apply + type regen
- cleanmatexsaas must not create these tables
- Tenant settings remain read-only for profile structure
- Completed: InitialStatusResolver / order-create stamps the effective profile/version snapshot for new orders; historic orders remain null by design.
- P0 follow-up: enforce the profile snapshot in worklists, available-actions, and command execution. No automatic historic-order backfill.

## 7. Approval

| Field | Value |
|-------|--------|
| Proposed | 2026-08-14 |
| Approved_By_Jh | _(operator applied `0444` local + remote 2026-08-14 — fill formal name if required)_ |
| Applied migration | `0444_sys_wf_profiles_and_versions.sql` ✅ local + remote |
| Preset catalog seed | `0445_sys_wf_profile_presets_seed.sql` _(pending review/apply)_ |
