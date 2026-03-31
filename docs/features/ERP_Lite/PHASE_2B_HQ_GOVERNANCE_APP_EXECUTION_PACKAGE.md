---
version: v1.0.0
last_updated: 2026-03-29
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_2B_HQ_APP_EXEC_PKG_2026_03_29
status: In Progress
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
