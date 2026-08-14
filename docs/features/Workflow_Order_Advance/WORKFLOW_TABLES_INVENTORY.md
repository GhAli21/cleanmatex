# Workflow Tables Inventory — Generations & Usage

**Document ID:** WF-TABLES-INVENTORY-001  
**Date:** 2026-08-14  
**Purpose:** Single reference for every workflow-related table currently in the shared DB (what Gen 0/1/2/3 mean, what is live vs deprecated, and how HQ/tenant should treat each).  
**Authority:** [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md), [ADR_SYS_WF_PROFILES.md](ADR_SYS_WF_PROFILES.md), migration `0444_sys_wf_profiles_and_versions.sql` (**applied** local + remote; types updated).

---

## 1. Big picture

The database holds **three+ generations** of workflow config. They are **not** one connected system yet.

| Gen | Era | Search hint in Table Editor | Role |
|-----|-----|-----------------------------|------|
| **0** | Pre–PRD-010 / obsolete | `work` | Deprecated leftovers |
| **1** | Template system (PRD-010) | `work` | Still the live **tenant preset** path |
| **2** | Workflow Order Advance V2 | `wf` | Live **engine catalogs** + release runtime + profile **assign stub** |
| **3** | HQ profiles | `wf` | `sys_wf_profiles_*` — publish/assign target (**`0444` applied** local + remote 2026-08-14) |

```
Gen 0 (deprecated):   org_workflow_rules, org_workflow_settings_cf, sys_workflow_step_cd
Gen 1 (still live):   sys_workflow_template_*  +  org_tenant_workflow_*
Gen 2 (V2 live):      sys_wf_* catalogs  +  org_wf_release_*  +  org_wf_profile_assign_cf (stub)
Gen 3 (`0444` applied):  sys_wf_profiles_cd / sys_wf_profile_ver_mst / sys_wf_prof_ver_scr_dtl
```

| Concern | Which generation |
|---------|------------------|
| Floor actions when `workflow_engine_v2` on | Gen **2** `sys_wf_*` |
| Tenant “which preset / toggles” | Gen **1** templates |
| Staff who can work which stage | `org_auth_user_workflow_roles` (RBAC, not graph) |
| HQ publish/assign target | Gen **3** after `0444` |
| Partial release / Ready≠release | Gen **2** `org_wf_release_*` (runtime, not graph config) |

`UNRESTRICTED` on many `sys_*` rows in Supabase Table Editor = **no RLS** (platform catalogs). `org_*` typically have tenant RLS.

---

## 2. Screenshot group A — search `work` (template era + leftovers)

### 2.1 Live Gen 1 — tenant preset config

| Table | Role | Connection |
|-------|------|------------|
| `sys_workflow_template_cd` | Global preset header | Root of Gen 1 config |
| `sys_workflow_template_stages` | Stages per template (seq, type) | Child of template |
| `sys_workflow_template_transitions` | Stage edges + `requires_*` flags | Child of template |
| `org_tenant_workflow_templates_cf` | Tenant ↔ template (`is_default`, `allow_back_steps`) | **Assign** Gen 1 |
| `org_tenant_workflow_settings_cf` | Tenant toggles: prep/assembly/qa/pieces/split | Tenant capabilities |
| `org_tenant_service_category_workflow_cf` | Per-category template + toggles | Category override |

**Connection today (Gen 1):**

```
sys_workflow_template_cd
  ├── sys_workflow_template_stages
  └── sys_workflow_template_transitions

org_tenant_workflow_templates_cf  → template_id
org_tenant_workflow_settings_cf   → tenant toggles
org_tenant_service_category_workflow_cf → category + optional template
```

Used by tenant `settings/workflows` when V2 flag is **off**, and still read by the V2 **profile viewer** for approved templates / settings / category overrides.

### 2.2 Related but not graph config

| Table | Role | Status |
|-------|------|--------|
| `org_auth_user_workflow_roles` | Staff workflow roles (RECEPTION, PREPARATION, QA, …) | **Live** RBAC — separate from status graph |
| `sys_ord_workflow_template_versions` | Template versioning / audit | **Sparse** use (e.g. workflow-context API) |

### 2.3 Gen 0 — deprecated / do not build HQ on these

| Table | DB comment / reality | Status |
|-------|----------------------|--------|
| `org_workflow_rules` | Replaced by `sys_workflow_template_transitions` | **DEPRECATED** |
| `org_workflow_settings_cf` | Replaced by Gen 1 tenant settings/templates | **DEPRECATED** but still referenced by some legacy APIs/UI (`workflow-service`, old status/transitions routes) |
| `sys_workflow_step_cd` | Old step codes (INTAKE, SORTING, WASHING, …) | **Legacy catalog** — not V2 engine authority |

---

## 3. Screenshot group B — search `wf` (V2 Order Advance)

### 3.1 Live Gen 2 — engine catalogs (global)

| Table | Role |
|-------|------|
| `sys_wf_statuses_cd` | Operational status dictionary |
| `sys_wf_screens_cd` | Floor/UI screen keys |
| `sys_wf_screen_status_cd` | Screen ↔ status membership |
| `sys_wf_transitions_cd` | From/to status edges + `gate_set_code` |
| `sys_wf_actions_cd` | Action codes + EN/AR + permission |
| `sys_wf_action_trans_cd` | Action × transition × screen — **engine authority** for `listAvailableActions` / `executeAction` |
| `sys_wf_gate_defs_cd` | Gate dictionary |
| `sys_wf_initial_rules_cd` | Create-order initial status rules |

**Important:** these are **platform-global**. Editing them affects every V2 tenant. There is **no** `profile_id` FK on these tables today.

### 3.2 Live Gen 2 — assign stub + runtime

| Table | Role | Gap |
|-------|------|-----|
| `org_wf_profile_assign_cf` | Tenant / branch / service → `wf_profile_id` + optional `wf_version_no` | **Stub** until Gen 3: `wf_profile_id` has no master table |
| `org_wf_release_mst` | Order release header (Ready ≠ release) | Runtime ops — **not** HQ graph config |
| `org_wf_release_ln` | Release lines | Runtime ops — **not** HQ graph config |

Also on orders (from `0427`, not shown in `wf` search alone):

- `org_orders_mst.wf_profile_id`
- `org_orders_mst.wf_version_no`
- `org_orders_mst.state_version`

Usually null until assign + order-create stamping are wired.

### 3.3 Gen 3 — HQ profiles (`0444` applied)

| Table | Role |
|-------|------|
| `sys_wf_profiles_cd` | HQ profile header |
| `sys_wf_profile_ver_mst` | Versions `DRAFT` / `PUBLISHED` / `RETIRED` + capability flags |
| `sys_wf_prof_ver_scr_dtl` | Enabled screens per version |

Seed: `WF_V2_STANDARD` v1 **PUBLISHED**. See [ADR_SYS_WF_PROFILES.md](ADR_SYS_WF_PROFILES.md).

---

## 4. Other related table (often missed in `work` / `wf` searches)

| Table | Role | Status |
|-------|------|--------|
| `org_ord_screen_contracts_cf` | Worklist contract: statuses + required permissions (`tenant_org_id` null = system default) | **Live** — used with Gen 2 screen resolution; tenant CRUD when V2 flag off |

Search for `screen` or `contract`, not only `work` / `wf`.

---

## 5. Before vs after `0444`

### Before `0444` (current applied schema)

| Path | Config source |
|------|----------------|
| V2 engine actions | Global Gen 2 `sys_wf_action_trans_cd` (+ transitions/gates) |
| Tenant preset / toggles | Gen 1 templates + settings + category |
| Profile assign | `org_wf_profile_assign_cf` stub (orphan UUID risk) |
| HQ profile publish | **Impossible** — no `sys_wf_profiles_*` |

### After `0444` (when applied)

| Path | Config source |
|------|----------------|
| Same Gen 2 engine catalogs | Unchanged (global) |
| Same Gen 1 until cutover | Still supported |
| Profile assign | FK → `sys_wf_profiles_cd` (+ optional version) |
| HQ publish/assign | Gen 3 profile + version + enabled screens + capabilities |

Profile still does **not** own a private copy of transitions/actions in V1.0 (see ADR §3).

---

## 6. What HQ (cleanmatexsaas) should manage

| Priority | Tables |
|----------|--------|
| Must (V2) | All Gen 2 `sys_wf_*` catalogs + validate graph |
| Must (assign) | Gen 3 profiles after `0444` + `org_wf_profile_assign_cf` |
| Must during dual-path | Gen 1 templates + `org_tenant_workflow_*` |
| Should | `org_ord_screen_contracts_cf` (system defaults) |
| Optional read-only | `org_wf_release_*` support inspector |
| Do not build new features on | Gen 0 deprecated tables |
| Not graph config | `org_auth_user_workflow_roles` (user/RBAC screens elsewhere) |

Full HQ screen matrix:  
`F:\jhapp\cleanmatexsaas\docs\features\SAAS_Platform_Management\Workflow_Engine_HQ\HQ_WORKFLOW_CONFIG_SCREENS_TABLE_MATRIX.md`

---

## 7. Quick discovery SQL

```sql
-- All workflow-ish tables
SELECT c.relname AS table_name, obj_description(c.oid) AS comment
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND (
    c.relname ILIKE '%workflow%'
    OR c.relname ILIKE 'sys_wf_%'
    OR c.relname ILIKE 'org_wf_%'
    OR c.relname ILIKE '%screen_contract%'
  )
ORDER BY c.relname;
```

Graph integrity (Gen 2): `scripts/workflow/check_sys_wf_graph.sql`

---

## 8. Related docs

| Doc | Topic |
|-----|--------|
| [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md) | Engine-first V1.0; HQ publish/assign |
| [ADR_SYS_WF_PROFILES.md](ADR_SYS_WF_PROFILES.md) | Gen 3 profile shape |
| [03_ERD_and_Data_Model.md](03_ERD_and_Data_Model.md) | Target ERD |
| [08_UI_UX_Screens.md](08_UI_UX_Screens.md) | Tenant vs HQ UI |
| Migration `0427_sys_wf_catalogs_and_state_version.sql` | Gen 2 catalogs + assign stub |
| Migration `0444_sys_wf_profiles_and_versions.sql` | Gen 3 profiles (create-only; review before apply) |

---

## 9. Changelog for this inventory

| Date | Note |
|------|------|
| 2026-08-14 | Initial inventory from live Table Editor (`work` + `wf` searches) + code/DB comments |
