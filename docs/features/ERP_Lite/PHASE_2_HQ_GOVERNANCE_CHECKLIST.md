---
version: v1.0.0
last_updated: 2026-03-29
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_2_HQ_GOV_CHECKLIST_2026_03_28
status: Complete
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Migration Source of Truth)
---

# ERP-Lite Phase 2 HQ Governance Checklist

## 1. Purpose

This document converts the approved ERP-Lite pack into the exact `Phase 2` governance-foundation checklist.

Phase 2 is limited to:
- HQ governance foundation
- shared governance schema design
- governance package model
- mapping rule model
- auto-post policy model
- resolver governance model
- migration drafting only

Phase 2 must not:
- implement tenant finance runtime behavior
- create tenant COA/GL runtime tables for Phase 3
- publish runtime-consumable packages prematurely
- apply any migration automatically

---

## 2. Canonical Dependencies

This checklist depends on:

- [V1_0_APPROVAL_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V1_0_APPROVAL_PACK.md)
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)
- [ACCOUNT_USAGE_CODE_CATALOG.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ACCOUNT_USAGE_CODE_CATALOG.md)
- [V1_POSTING_RULES_CATALOG.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V1_POSTING_RULES_CATALOG.md)
- [BLOCKING_POLICY_TABLE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/BLOCKING_POLICY_TABLE.md)

If any of the above are revised, this checklist must be revalidated.

---

## 3. Phase 2 Outcome

Phase 2 is complete only when all of the following are true:

- account types are modeled as HQ-governed system data
- usage code and event catalogs exist as governed system data
- resolver catalog exists as governed system data
- governance package and mapping rule models are defined
- auto-post policy model is defined at HQ level
- new shared schema migrations are drafted in `cleanmatex`
- no migration is applied by the agent
- implementation can move to Phase 3 without governance ambiguity
- implementation can move through v2 and v3 without redesigning Phase 2 governance tables

## 3.1 Current Execution Status

Current status: `Complete`

Current work state:

- Phase 2 cross-project start is approved
- migrations `0179` to `0182` were created, revised, and applied
- Phase 2 is now the accepted future-safe governance baseline for v1/v2/v3 growth

---

## 4. Cross-Project Ownership Split

## 4.1 `cleanmatexsaas` Ownership in Phase 2

Platform HQ owns:

- account type governance
- account group governance
- event catalog governance
- usage code governance
- mapping rule governance
- governance package lifecycle
- auto-post policy governance

## 4.2 `cleanmatex` Ownership in Phase 2

Tenant runtime project owns:

- database migration source of truth
- shared schema migration files
- future runtime consumption contracts
- no cross-tenant HQ runtime behavior

## 4.3 Critical Rule

Phase 2 governance tables are shared DB objects, but their operational ownership is HQ-level.

That means:

- schema migrations are created only in `cleanmatex`
- HQ governance data is authored and managed from `cleanmatexsaas`
- tenant runtime must not treat governance tables as tenant-editable

---

## 5. Governance Catalog Checklist

## 5.1 Required HQ Catalogs

Phase 2 must define:

- account types
- account groups
- event catalog
- usage code catalog
- resolver catalog

## 5.2 Required Actions

- [x] freeze the account type seed set
- [x] freeze the account group seed set
- [x] freeze the locked v1 event catalog seed set
- [x] freeze the v1 usage code seed set
- [x] freeze the v1 resolver seed set
- [x] explicitly exclude speculative v2/v3 seed data unless approved for DB storage now
- [x] ensure schema extensibility for v2/v3 without redesign

---

## 6. Governance Package Checklist

Phase 2 must define:

- governance package master
- package lifecycle status model
- package compatibility version
- package catalog version references

Required actions:

- [x] freeze the package status values
- [x] freeze the package compatibility field
- [x] freeze which catalog versions are tracked on package rows
- [x] ensure runtime cannot consume draft packages
- [x] ensure resolver catalog version can be traced with the package

---

## 7. Mapping Rule Checklist

Phase 2 must define:

- rule header model
- rule line model
- line ordering
- usage code resolution behavior
- resolver-code support where usage code is conditional

Required actions:

- [x] freeze the rule header fields
- [x] freeze the rule line fields
- [x] support multi-line entries
- [x] support conditional account resolution
- [x] support rule version tracking
- [x] prevent free-text resolver drift
- [x] enforce deterministic rule priority within package/event scope

---

## 8. Auto-Post Policy Checklist

Phase 2 must define:

- per-event auto-post policy model
- blocking/non-blocking mode
- required-success flag
- retry/repost flags
- failure action code

Required actions:

- [x] freeze the v1 blocking policy fields
- [x] ensure policy remains HQ-owned
- [x] ensure runtime can trace policy version/package
- [x] ensure non-blocking flows still produce visible finance exceptions
- [x] ensure policy rows can evolve in v2/v3 without redesign

---

## 9. Migration Checklist

Phase 2 migration drafting should currently use:

- `0179_erp_lite_phase2_account_governance.sql`
- `0180_erp_lite_phase2_event_usage.sql`
- `0181_erp_lite_phase2_gov_rules.sql`
- `0182_erp_lite_phase2_auto_post_policy.sql`

Required actions:

- [x] review all four drafts against approved docs
- [x] confirm object names remain within repo DB naming rules
- [x] confirm no tenant runtime tables leaked into Phase 2
- [x] confirm no migration is applied by the agent

---

## 10. Explicitly Deferred From Phase 2

Do not implement in Phase 2:

- tenant COA tables
- tenant GL tables
- posting logs
- posting exceptions
- tenant account mapping tables
- runtime posting services
- report queries
- cleanmatexsaas UI code if current context cannot safely switch there

---

## 11. Final Readiness Gate

Phase 2 can proceed safely only when:

- this checklist is accepted
- the Phase 2 execution package is accepted
- migrations `0179` to `0182` are reviewed, approved, and applied
