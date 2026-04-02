---
version: v1.0.0
last_updated: 2026-04-03
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_2B_HQ_APP_EXEC_PKG_2026_03_29
status: Complete
implementation_project: cleanmatexsaas
project_context: Platform Level HQ
---

# ERP-Lite Phase 2B HQ Governance App Execution Package

## 1. Purpose

This document is the implementation-ready package for `Phase 2B: HQ Governance App Layer`.

It defines:
- exact backend scope in `cleanmatexsaas`
- exact frontend scope in `cleanmatexsaas`
- exact ownership boundaries
- exact validation and publication responsibilities

---

## 2. Scope

Phase 2B includes:
- HQ catalog browsing
- HQ draft package authoring
- HQ draft mapping rule authoring
- HQ draft auto-post policy authoring
- HQ package validation
- HQ approval/publication workflow

Phase 2B does not include:
- tenant runtime posting
- tenant mapping setup
- tenant COA/GL screens
- new database migrations in `cleanmatexsaas`

---

## 3. Backend Deliverables

- service-role governance repository/services
- catalog read endpoints
- package CRUD endpoints
- mapping rule CRUD endpoints
- auto-post policy CRUD endpoints
- validation endpoint
- approve/publish endpoint

---

## 4. Frontend Deliverables

- ERP-Lite Governance nav entry
- governance dashboard shell
- catalogs module
- package management module
- mapping rules module
- auto-post policy module
- validate/approve/publish workflow UI

---

## 5. Critical Rules

- use service-role access patterns only
- no migration authoring here
- no direct tenant-runtime assumptions in HQ UI
- publication lifecycle must respect `DRAFT -> APPROVED -> PUBLISHED`

---

## 6. Immediate Next Decision

Before coding Phase 2B, confirm:

1. exact `cleanmatexsaas` routes/screens
2. exact HQ permissions/roles
3. exact API contract shape for publication actions

## 7. Current Progress Snapshot

Current implementation already covers:

1. governance dashboard and catalog browsing in `cleanmatexsaas`
2. governance package list and package detail drill-down
3. package validation endpoint and UI action
4. package approval endpoint and UI action
5. package publication endpoint and UI action

Phase 2B implementation now also covers:

1. draft package creation
2. draft package metadata editing
3. draft mapping rule editing
4. draft auto-post policy editing
5. ERP-Lite template package authoring
6. ERP-Lite template COA line authoring
7. ERP-Lite template usage-mapping authoring
8. ERP-Lite template period-policy authoring
9. ERP-Lite template operational-default authoring
10. ERP-Lite template assignment authoring
11. explicit tenant resolution, validate, apply, reapply, and history flows

Validation:

1. `cleanmatexsaas` platform-api production build passes
2. `cleanmatexsaas` platform-web production build passes
