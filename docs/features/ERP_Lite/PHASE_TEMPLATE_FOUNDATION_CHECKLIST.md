---
document_id: ERP_LITE_PHASE_TEMPLATE_FOUNDATION_CHECKLIST
title: ERP-Lite Template Foundation Checklist
version: "1.1"
status: Complete
last_updated: 2026-04-03
author: CleanMateX AI Assistant
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite Template Foundation Checklist

## Purpose

This checklist freezes the exact cross-project scope for moving ERP-Lite default setup from hardcoded baseline seeding to HQ-governed templates.

## Phase Boundary

This phase includes:
- shared DB template catalog design
- HQ authoring/publish app design
- tenant materialization design
- assignment strategy
- manual HQ-only provisioning correction

This phase excludes:
- automatic ERP-Lite seeding from tenant creation
- historical tenant conversion rollout beyond the applied template-first backfill path

## Canonical Dependencies

- [ADR_011_ERP_LITE_TEMPLATE_GOVERNANCE_MODEL.md](ADR_011_ERP_LITE_TEMPLATE_GOVERNANCE_MODEL.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](ERP_LITE_FINANCE_CORE_RULES.md)
- [HQ_TENANT_RESPONSIBILITY_MATRIX.md](HQ_TENANT_RESPONSIBILITY_MATRIX.md)

## No-Coding-Before Gates

- no DB migrations before template table set is frozen
- no HQ UI work before package lifecycle and assignment model are frozen
- no tenant materialization work before copy contract is frozen
- no replacement of current default seed logic before fallback strategy is agreed
- no production signoff while tenant insert still auto-materializes ERP-Lite data

## Required Decisions

- template package header shape
- `sys_main_business_type_cd` linkage as the primary selector
- template section split
- assignment model
- publication model
- tenant apply log shape
- reapply / upgrade behavior
- fallback behavior when no explicit assignment exists

## Required Shared DB Objects

- package header
- template COA detail
- usage template detail
- period template header/detail
- operational defaults detail
- assignment table
- tenant application log

## Required HQ App Capabilities

- list template packages
- create draft package
- edit package metadata
- edit COA template rows
- edit usage mappings
- edit period policy
- edit operational defaults
- validate package
- approve package
- publish package
- preview assignment impact

## Required Tenant Runtime Capabilities

- resolve assigned package
- copy template to tenant `org_*`
- record application log
- show applied package/version in setup UI
- never seed ERP-Lite finance data automatically during tenant creation

## Validation Criteria

- one published template can initialize a tenant without manual SQL
- template package can be assigned by rule or explicitly
- tenant runtime can operate without querying draft HQ rows
- tenant copy function is idempotent
- required v1 usage mappings are present after materialization

## Completion Notes

- shared DB template foundation is applied through migrations `0198` to `0202`
- business-type keyed published baseline packages now exist
- tenant runtime now resolves and applies published templates first
- `0196` and `0197` are superseded and intentionally not applied
- migration `0203` is applied and tenant auto-init is removed
- the next step is `cleanmatexsaas` HQ authoring, validation, approval, publish, assignment, and manual tenant-apply UX/API implementation

## Exit Criteria

- ADR-011 reviewed
- execution package completed
- migration-ready DB object list frozen
- API contract list frozen
- UI screen list frozen
- fallback strategy agreed
- shared DB migrations `0198` to `0202` applied
- corrective migration `0203` reviewed and applied
