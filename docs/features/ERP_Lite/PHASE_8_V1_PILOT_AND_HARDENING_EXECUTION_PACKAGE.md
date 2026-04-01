---
version: v1.0.0
last_updated: 2026-03-31
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_8_HARDENING_EXEC_PKG_2026_03_31
status: In Progress
implementation_project: cleanmatex
project_context: Tenant Runtime
---

# ERP-Lite Phase 8 V1 Pilot and Hardening Execution Package

## 1. Purpose

This document defines the implementation-ready hardening package for `Phase 8: V1 Pilot and Hardening`.

## 2. Scope

Phase 8 includes:
- consolidated regression validation for posting engine, auto-post, reporting, and Phase 7 runtime
- last-mile runtime fixes found through validation
- explicit tracking of environment blockers versus code blockers

Phase 8 does not include:
- v2 treasury, suppliers, AP, or PO runtime
- v3 advanced controls, profitability, or costing
- cleanmatexsaas authoring and publish workflow completion

## 3. Hardening Deliverables

### 3.1 Regression Command

The canonical Phase 8 regression command is:

```bash
npm run test:erp-lite --workspace=web-admin
```

This command must cover:
- posting engine tests
- auto-post adapter tests
- invoice/payment integration tests
- reporting tests
- expense and petty-cash service tests
- expense action tests

### 3.2 Validation Evidence

Phase 8 should record:
- regression command result
- `check:i18n` result
- build result or clear environment blocker note

### 3.3 Known Environment Blocker Handling

If `web-admin` production build still does not finish within the local environment:
- record it as an environment validation blocker only if targeted tests remain green
- do not misclassify environment timeouts as feature defects without evidence

## 4. Current Hardening State

Current progress:

1. Phase 7 service-level runtime validation is implemented
2. Phase 7 action-level redirect and error-handling validation is implemented
3. ERP-Lite regression script is added to `web-admin/package.json`
4. the full ERP-Lite regression command passes with 7 suites and 22 tests
5. `check:i18n` passes
6. `npm run web-admin:build` starts cleanly and generates `.next` compile artifacts
7. the remaining unresolved validation item is the long-running production build timeout without a diagnostic

## 5. Close-Out Rule

Phase 8 can be marked complete only after:
- the ERP-Lite regression command passes
- no newly discovered high-risk runtime defects remain open
- the implementation tracker is updated with the final hardening outcome
