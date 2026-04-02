---
document_id: ERP_LITE_PHASE_TEMPLATE_FOUNDATION_EXECUTION_PACKAGE
title: ERP-Lite Template Foundation Execution Package
version: "1.1"
status: Complete
last_updated: 2026-04-03
author: CleanMateX AI Assistant
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite Template Foundation Execution Package

## Current Status

The shared DB foundation for ERP-Lite templates is now applied through migrations `0198` to `0203`.

This means:
- business-type keyed template packages are live
- published baseline template packages are seeded
- tenant template resolution and materialization are live
- tenant-insert auto-init has been removed
- ERP-Lite template provisioning is now HQ-driven and explicit only
- `0196` and `0197` are superseded and intentionally not applied

The HQ authoring and manual publication/provisioning app layer is now implemented in `cleanmatexsaas`.

Current HQ app-layer coverage:
- template package list/detail authoring
- template COA line authoring
- template usage mapping authoring
- template period-policy authoring
- template operational-default authoring
- template assignment authoring
- tenant resolution, validate, apply, reapply, and history flows

## 1. Goal

Design the exact ERP-Lite template architecture so HQ can manage many default finance setups and tenant runtime can materialize the right one safely.

## 2. Final Architecture

### 2.1 Ownership Split

`cleanmatexsaas`
- authors templates
- validates templates
- approves and publishes templates
- assigns templates to tenants or tenant classes

`cleanmatex`
- owns migrations for shared DB objects
- materializes published templates into tenant runtime `org_*`
- executes posting/reporting only against tenant materialized rows
- must not auto-materialize ERP-Lite data from tenant insert events

### 2.2 Runtime Safety Rule

Tenant runtime must never read mutable template draft rows during posting or reporting.

Only tenant-copied `org_*` data is runtime-authoritative.

## 3. Exact Database Design

### 3.1 Shared Package Header

**Table:** `sys_fin_tpl_pkg_mst`

Purpose:
- one package version groups all template sections

Core fields:
- `tpl_pkg_id`
- `tpl_pkg_code`
- `version_no`
- `name`, `name2`
- `description`, `description2`
- `phase_scope_code`
- `main_business_type_code`
- `country_code`
- `plan_code`
- `status_code`
- `compat_version`
- `effective_from`, `effective_to`
- audit fields

Status model:
- `DRAFT`
- `APPROVED`
- `PUBLISHED`
- `SUPERSEDED`
- `RETIRED`

Primary classification rule:
- `main_business_type_code` must FK to `public.sys_main_business_type_cd(business_type_code)`
- this is the first selector for ERP-Lite template resolution
- country, plan, and tenant assignment are refinements on top of main business type

### 3.2 COA Template Header and Detail

**Tables:**
- `sys_fin_coa_tpl_mst`
- `sys_fin_coa_tpl_dtl`

`sys_fin_coa_tpl_mst`:
- one COA section per package
- `tpl_pkg_id`
- `coa_template_code`
- labels and notes

`sys_fin_coa_tpl_dtl`:
- `coa_tpl_line_id`
- `coa_template_id`
- `parent_tpl_line_id`
- `account_code`
- `acc_type_id`
- `acc_group_id`
- `name`, `name2`
- `description`, `description2`
- `is_postable`
- `is_control_account`
- `is_system_linked`
- `manual_post_allowed`
- `branch_mode_code`
- `usage_hint_code`
- `rec_order`

Rules:
- account codes unique inside a template
- parent hierarchy stored by template row, not by tenant row
- usage hint is informational only; real mapping lives in usage template table

### 3.3 Usage Mapping Template

**Table:** `sys_fin_usage_tpl_dtl`

Purpose:
- map HQ usage codes to template account codes

Fields:
- `usage_tpl_id`
- `tpl_pkg_id`
- `usage_code_id`
- `target_account_code`
- `branch_scope_code`
- `is_required`
- `rec_order`

Rules:
- references template account code, not tenant account ID
- one global active target per usage code in the template unless branch-specific policy is introduced

### 3.4 Period Template

**Tables:**
- `sys_fin_period_tpl_mst`
- `sys_fin_period_tpl_dtl`

Recommended model:
- header stores policy
- detail optional for explicit named sequences

Header fields:
- `fiscal_year_start_month`
- `period_style_code`
- `seed_horizon_months`
- `default_open_status_code`

Supported v1 initial style:
- monthly periods
- current year + next year

### 3.5 Operational Defaults Template

**Table:** `sys_fin_oper_tpl_dtl`

Purpose:
- future-safe operational defaults per package

Examples:
- default petty cash cashbox linked to template account code
- default branch profitability allocation starter rows later
- default costing component starter rows later

Rules:
- no fake supplier records
- no fake bank statements
- no fake AP/PO documents

### 3.6 Assignment Model

**Table:** `sys_fin_tpl_assign_mst`

Purpose:
- determine which tenants get which package

Fields:
- `assignment_id`
- `tpl_pkg_id`
- `assignment_mode`
- `tenant_org_id` nullable
- `main_business_type_code` nullable
- `country_code` nullable
- `plan_code` nullable
- `priority_no`
- `is_default_fallback`

Resolution order:
1. explicit tenant assignment
2. main business type + country + plan match
3. main business type + country match
4. main business type match
5. default fallback published package

### 3.7 Tenant Apply Log

**Table:** `org_fin_tpl_apply_log`

Purpose:
- audit tenant materialization

Fields:
- `tenant_org_id`
- `tpl_pkg_id`
- `tpl_pkg_code`
- `tpl_pkg_version`
- `apply_mode_code`
- `applied_at`
- `applied_by`
- `apply_result_code`
- `notes`

## 4. Exact Backend Contracts

### 4.1 `cleanmatexsaas` Backend Modules

1. `erp-lite-template-packages`
- create draft package
- update metadata
- list versions
- get package detail

2. `erp-lite-template-coa`
- add/edit/delete COA lines
- validate hierarchy
- validate account-code uniqueness

3. `erp-lite-template-usage`
- add/edit/delete usage template rows
- validate required v1 usage coverage

4. `erp-lite-template-periods`
- save period policy
- preview generated periods

5. `erp-lite-template-assignments`
- create assignment rules
- preview tenant resolution

6. `erp-lite-template-publication`
- validate package
- approve package
- publish package
- supersede package

### 4.2 Recommended API Endpoints

`cleanmatexsaas` API:
- `GET /erp-lite/templates`
- `POST /erp-lite/templates`
- `GET /erp-lite/templates/:id`
- `PATCH /erp-lite/templates/:id`
- `GET /erp-lite/templates/:id/coa`
- `POST /erp-lite/templates/:id/coa-lines`
- `PATCH /erp-lite/templates/:id/coa-lines/:lineId`
- `DELETE /erp-lite/templates/:id/coa-lines/:lineId`
- `GET /erp-lite/templates/:id/usage-mappings`
- `POST /erp-lite/templates/:id/usage-mappings`
- `PATCH /erp-lite/templates/:id/usage-mappings/:mappingId`
- `DELETE /erp-lite/templates/:id/usage-mappings/:mappingId`
- `GET /erp-lite/templates/:id/period-policy`
- `PUT /erp-lite/templates/:id/period-policy`
- `GET /erp-lite/templates/:id/assignments`
- `POST /erp-lite/templates/:id/assignments`
- `PATCH /erp-lite/templates/:id/assignments/:assignmentId`
- `POST /erp-lite/templates/:id/validate`
- `POST /erp-lite/templates/:id/approve`
- `POST /erp-lite/templates/:id/publish`
- `GET /erp-lite/templates/:id/impact-preview`
- `GET /erp-lite/template-provisioning/tenants/:tenantId/resolution`
- `POST /erp-lite/template-provisioning/tenants/:tenantId/validate`
- `POST /erp-lite/template-provisioning/tenants/:tenantId/apply`
- `POST /erp-lite/template-provisioning/tenants/:tenantId/reapply`
- `GET /erp-lite/template-provisioning/tenants/:tenantId/history`

### 4.3 `cleanmatex` Backend Responsibilities

`cleanmatex` does not author templates.

It must provide:
- package resolution by tenant
- materialize published template into tenant runtime
- setup-status endpoint showing package/version used
- no automatic tenant-insert hook for ERP-Lite provisioning

Recommended server-side functions:
- `resolve_tenant_erp_lite_template(p_tenant_id uuid)`
- `apply_tenant_erp_lite_template(p_tenant_id uuid, p_tpl_pkg_id uuid, p_apply_mode text)`
- `preview_tenant_erp_lite_template_apply(p_tenant_id uuid, p_tpl_pkg_id uuid)`

### 4.4 Exact HQ Provisioning Backend Rules

Provisioning must be explicit and auditable:
- tenant creation never calls template materialization
- `validate` performs preflight checks only and writes no tenant finance rows
- `apply` invokes `apply_fin_tpl_for_tnt(...)` with `MANUAL`
- `reapply` is allowed only under controlled HQ rules and must always write a new apply-log row
- every provisioning action must capture HQ actor identity in the service layer

## 5. Exact Frontend Design

### 5.1 `cleanmatexsaas` HQ UI

Main navigation section:
- `ERP-Lite`
  - Template Packages
  - COA Templates
  - Usage Mapping Templates
  - Period Policies
  - Assignment Rules
  - Publish Queue
  - Tenant Provisioning

Main screens:

1. **Template Packages List**
- package code
- version
- main business type / country / plan
- status
- published badge
- actions: edit, validate, approve, publish, clone

2. **Template Workspace**
- metadata panel
- tabs:
  - COA
  - Usage Mappings
  - Period Policy
  - Operational Defaults
  - Assignments
  - Validation

3. **COA Template Editor**
- hierarchical table/tree
- account code
- account type/group
- postable/control/system flags
- EN/AR names

4. **Usage Mapping Editor**
- required usage coverage checklist
- target template account code selector
- validation status

5. **Period Policy Editor**
- fiscal year start
- style monthly
- horizon preview

6. **Assignment Rules Screen**
- explicit tenant assignments
- class-based assignments
- fallback priority order

7. **Validation / Publish Screen**
- readiness checks
- missing usage coverage
- duplicate codes
- invalid hierarchy
- publish confirmation

8. **Tenant Provisioning Screen**
- tenant identity, business type, country, and plan summary
- resolved package preview and why it resolved
- validation output before apply
- explicit apply button
- controlled reapply button
- provisioning history from `org_fin_tpl_apply_log`
- warning banner when tenant runtime finance rows already exist

### 5.2 `cleanmatex` Tenant UI

Tenant-facing additions:
- ERP-Lite setup status card
- applied template code/version
- applied timestamp
- materialization warnings if missing

No tenant screen should edit HQ template rows.

## 6. Validation Rules

Package publish must fail when:
- no COA section exists
- duplicate template account codes exist
- required v1 usage codes have no template account target
- referenced account code does not exist in COA template
- period policy is incomplete
- more than one fallback template is active for same assignment scope

Tenant materialization must fail safely when:
- assigned package is not `PUBLISHED`
- package is incompatible
- required governance catalogs are missing

## 7. Migration Strategy

### Phase A

Add shared template tables and apply log in `cleanmatex`.

### Phase B

Build `cleanmatexsaas` authoring and publication flows.

### Phase C

Build `cleanmatex` template-resolution and materialization functions.

### Phase D

Remove automatic tenant-insert provisioning and switch to explicit HQ-only apply.

### Phase E

Build `cleanmatexsaas` tenant provisioning flows on top of the manual-only path.

## 8. Transition Strategy

Current auto-init template provisioning should be treated as transitional and corrected before production signoff.

Recommended transition:
- keep the applied template package foundation
- remove the tenant-insert auto-init hook via `0203`
- move all provisioning to explicit HQ validate/apply/reapply flows
- keep tenant runtime strictly materialized-data only

## 9. Deliverables

- ADR-011 approved
- template foundation migrations drafted
- HQ API contract defined
- HQ UI route map defined
- tenant materialization contract defined
- manual HQ-only provisioning contract defined
- rollout transition plan defined

## Related Documents

- [ADR_011_ERP_LITE_TEMPLATE_GOVERNANCE_MODEL.md](ADR_011_ERP_LITE_TEMPLATE_GOVERNANCE_MODEL.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)
- [HQ_TENANT_RESPONSIBILITY_MATRIX.md](HQ_TENANT_RESPONSIBILITY_MATRIX.md)
