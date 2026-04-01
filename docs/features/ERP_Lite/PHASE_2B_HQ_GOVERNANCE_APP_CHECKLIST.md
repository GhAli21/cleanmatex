---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_2B_HQ_APP_CHECKLIST_2026_03_29
status: Complete
implementation_project: cleanmatexsaas
project_context: Platform Level HQ
---

# ERP-Lite Phase 2B HQ Governance App Checklist

## 1. Purpose

This document defines the exact checklist for `Phase 2B: HQ Governance App Layer`.

Phase 2B is limited to:
- HQ governance backend in `cleanmatexsaas`
- HQ governance admin UI in `cleanmatexsaas`
- package/rule/policy authoring workflows
- governance validation and publication controls

Phase 2B must not:
- create database migrations in `cleanmatexsaas`
- implement tenant runtime posting
- implement tenant COA/GL runtime tables

---

## 2. Canonical Dependencies

This checklist depends on:

- [PHASE_2_HQ_GOVERNANCE_CHECKLIST.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/PHASE_2_HQ_GOVERNANCE_CHECKLIST.md)
- [PHASE_2_HQ_GOVERNANCE_EXECUTION_PACKAGE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/PHASE_2_HQ_GOVERNANCE_EXECUTION_PACKAGE.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)
- [ACCOUNT_USAGE_CODE_CATALOG.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ACCOUNT_USAGE_CODE_CATALOG.md)
- [V1_POSTING_RULES_CATALOG.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V1_POSTING_RULES_CATALOG.md)
- [BLOCKING_POLICY_TABLE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/BLOCKING_POLICY_TABLE.md)

---

## 3. Phase 2B Outcome

Phase 2B is complete only when all of the following are true:

- HQ can view governed catalogs
- HQ can author draft governance packages
- HQ can author/edit draft mapping rules
- HQ can author/edit draft auto-post policies
- HQ can validate package consistency before publication
- HQ can approve/publish packages according to the publication contract

## 3.1 Current Execution Status

Current status: `Complete`

---

## 4. Backend Checklist

- [x] add service-role data access layer in `cleanmatexsaas`
- [x] expose read APIs for account types, groups, events, usage codes, resolvers
- [x] expose CRUD APIs for draft packages, rules, and policies
- [x] expose package validation API
- [x] expose approve/publish workflow API
- [x] prevent runtime use of unpublished packages

---

## 5. Frontend Checklist

- [x] add HQ navigation entry for ERP-Lite Governance
- [x] add catalog screens for governed masters
- [x] add governance package list/detail screens
- [x] add mapping rule list/detail/editor screens
- [x] add auto-post policy management screens
- [x] add validate/approve/publish actions with audit visibility

---

## 6. Critical Rules

- [x] use `cleanmatexsaas` context only
- [x] do not create migrations in `cleanmatexsaas`
- [x] use service-role admin patterns, not tenant runtime RLS patterns
- [x] treat Phase 2A DB structure as the source of truth

---

## 7. Final Readiness Gate

Phase 2B can start safely only when:

- Phase 2A is complete
- `cleanmatexsaas` context is activated
- a project-specific execution package is accepted
