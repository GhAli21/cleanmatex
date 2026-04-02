---
document_id: ADR_011_ERP_LITE_TEMPLATE_GOVERNANCE_MODEL
title: ADR-011 ERP-Lite Template Governance Model
version: "1.0"
status: Active
last_updated: 2026-04-03
author: CleanMateX AI Assistant
owner: Cross-Project
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ADR-011 ERP-Lite Template Governance Model

## Status

Active

## Context

ERP-Lite currently has:
- HQ-governed catalogs, rules, and auto-post policies
- tenant-owned runtime `org_*` finance data
- a need for ideal default finance setup without hardcoding one forever-fixed baseline in migration logic

The next scalable step is to introduce HQ-governed ERP-Lite templates that can be:
- authored and versioned centrally
- validated and published centrally
- copied into tenant runtime only through explicit HQ provisioning actions

This must preserve the existing non-negotiable rule:

> runtime posting must execute only against tenant-owned runtime data, never directly against mutable HQ draft rows

## Decision

ERP-Lite will use a **template publication and materialization model**.

HQ in `cleanmatexsaas` will manage published ERP-Lite templates.
Tenant runtime in `cleanmatex` will copy the selected published template into tenant `org_*` tables.

Runtime posting, reporting, AP/PO, bank reconciliation, expenses, petty cash, profitability, and costing will always use tenant materialized data only.

## Core Model

### 1. Template Layers

The template model is split into these layers:

1. **COA Template**
   - account tree structure
   - account type/group linkage
   - control/system/manual-post constraints
   - default account codes and labels

2. **Usage Mapping Template**
   - maps HQ usage codes to template account codes
   - does not reference tenant account IDs

3. **Period Policy Template**
   - fiscal year start month
   - period style
   - seeding horizon
   - opening period state

4. **Operational Default Template**
   - petty cash default cashbox definitions
   - default bank account placeholders policy only when explicitly supported
   - future v2/v3 optional defaults

5. **Assignment Template**
   - which tenant profile receives which template
   - rules by main business type, plan, country, template family, or explicit assignment

### 2. Publication Rule

HQ may author many draft templates, but tenant runtime may materialize only:
- `PUBLISHED` template packages
- with compatible version
- with complete required sections

### 3. Materialization Rule

Publishing does not make runtime use the template directly.

Instead:
- HQ publishes template package
- HQ selects the published template for a tenant
- HQ previews and validates the provisioning action
- HQ triggers explicit materialization for the tenant
- copy function materializes template data into tenant `org_*` rows
- runtime uses the copied tenant rows only

### 4. Version Traceability Rule

Every tenant materialization must record:
- template package code
- template package version
- materialized at timestamp
- materialized by actor or automation source

This is required so tenant runtime remains auditable and historically stable.

## Why This Decision

This model avoids three bad outcomes:

1. hardcoded finance setup in one-off migrations
2. runtime dependence on mutable HQ working rows
3. duplicated tenant initialization logic scattered across app services
4. hidden ERP-Lite finance seeding during tenant creation

It also supports:
- different default COA shapes by region or vertical
- different default COA shapes by `sys_main_business_type_cd`
- future v2/v3 additions without redesigning tenant runtime
- safe pilot templates and production templates

## Database Design Direction

### Shared DB Objects in `cleanmatex`

The source-of-truth migrations remain in `cleanmatex`.

Planned template objects:
- `sys_fin_tpl_pkg_mst`
- `sys_fin_tpl_assign_mst`
- `sys_fin_coa_tpl_mst`
- `sys_fin_coa_tpl_dtl`
- `sys_fin_usage_tpl_dtl`
- `sys_fin_period_tpl_mst`
- `sys_fin_period_tpl_dtl`
- `sys_fin_oper_tpl_dtl`
- `org_fin_tpl_apply_log`

### Status Model

Template package statuses:
- `DRAFT`
- `APPROVED`
- `PUBLISHED`
- `SUPERSEDED`
- `RETIRED`

Runtime materialization may use only `PUBLISHED`.

### Key Relationships

- package header owns template sections
- package header links to `sys_main_business_type_cd` as the primary classification axis
- template detail rows reference governance catalogs by code or ID
- usage template rows reference template account codes, not tenant IDs
- tenant apply log records package/version materialized to each tenant

## Backend Design Direction

### `cleanmatexsaas` Backend

Required backend modules:
- `erp-lite-template-packages`
- `erp-lite-template-coa`
- `erp-lite-template-mappings`
- `erp-lite-template-periods`
- `erp-lite-template-assignments`
- `erp-lite-template-publication`

Key API responsibilities:
- create/edit draft package
- add/edit/delete template account rows
- add/edit usage mapping template rows
- configure period policy template
- configure assignment rules
- validate package completeness
- approve package
- publish package
- preview tenant impact
- validate tenant provisioning
- apply package to tenant explicitly
- reapply package to tenant under controlled rules

### `cleanmatex` Backend

Required runtime responsibilities:
- resolve default package for tenant
- materialize template into tenant runtime
- log application in `org_fin_tpl_apply_log`
- provide safe re-apply / upgrade rules later if allowed
- never auto-materialize ERP-Lite data from `org_tenants_mst` insert events

Tenant runtime must not:
- read mutable draft template rows
- use HQ template tables during posting
- silently remap existing tenant accounts after go-live

## Frontend Design Direction

### `cleanmatexsaas` Frontend

Required HQ screens:
- Template Packages
- COA Template Editor
- Usage Mapping Template Editor
- Period Template Editor
- Operational Defaults Editor
- Assignment Rules
- Validate / Approve / Publish
- Tenant Preview / Impact Preview
- Tenant Template Provisioning

UI expectations:
- package list with status/version
- draft vs published visibility
- side-by-side EN/AR labels
- row validation before publish
- clear indication of required v1/v2/v3 sections

### `cleanmatex` Frontend

Required tenant screens:
- ERP-Lite setup status
- selected template name/version
- template applied timestamp
- missing mapping or missing activation warnings

Tenant UI does not author HQ templates.

## Materialization Flow

1. HQ creates package draft
2. HQ edits COA, mappings, periods, and defaults
3. HQ validates package
4. HQ approves package
5. HQ publishes package
6. Tenant is created without ERP-Lite finance side effects
7. HQ opens tenant template provisioning in `cleanmatexsaas`
8. `cleanmatex` resolves the assigned published package
9. HQ validates the tenant-level provisioning action
10. copy function creates missing tenant runtime rows
11. apply log is recorded
12. runtime posting uses tenant `org_*` rows only

## Non-Goals

- live runtime posting from HQ template tables
- allowing tenants to change HQ template logic
- auto-overwriting tenant-customized COA on every publish
- using templates as a shortcut around required mapping validation
- auto-seeding ERP-Lite finance data from `org_tenants_mst` insert events

## Operational Constraints

- all shared template schema objects are created by migrations in `cleanmatex`
- `cleanmatexsaas` never creates migrations
- template publishing must remain compatible with governance publication contract
- tenant materialization must be idempotent
- tenant materialization must preserve tenant isolation and RLS on `org_*`

## Approval Dependencies

- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](ERP_LITE_FINANCE_CORE_RULES.md)
- [HQ_TENANT_RESPONSIBILITY_MATRIX.md](HQ_TENANT_RESPONSIBILITY_MATRIX.md)
- future template foundation checklist and execution package

## Related Documents

- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)
- [HQ_TENANT_RESPONSIBILITY_MATRIX.md](HQ_TENANT_RESPONSIBILITY_MATRIX.md)
- [ACCOUNT_USAGE_CODE_CATALOG.md](ACCOUNT_USAGE_CODE_CATALOG.md)
- [ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md](ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md)
- [ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md](ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md)
