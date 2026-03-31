---
version: v1.0.0
last_updated: 2026-03-30
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_6_FINANCE_CHECKLIST_2026_03_30
status: Complete
implementation_project: cleanmatex
project_context: Tenant Runtime
---

# ERP-Lite Phase 6 Finance Inquiry and Reports Checklist

## 1. Purpose

This document defines the exact checklist for `Phase 6: V1 Finance Inquiry and Reports`.

Phase 6 is limited to:
- GL inquiry in `cleanmatex`
- trial balance in `cleanmatex`
- profit and loss in `cleanmatex`
- balance sheet in `cleanmatex`
- AR aging in `cleanmatex`
- finance-safe report rendering from posted journals
- report filters and export-ready presentation preparation

Phase 6 must not:
- use ad hoc invoice-only calculations as financial source of truth
- bypass posted journal data
- introduce new HQ governance schema

## 2. Canonical Dependencies

- [PHASE_5_CORE_AUTO_POST_EXECUTION_PACKAGE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/PHASE_5_CORE_AUTO_POST_EXECUTION_PACKAGE.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

## 3. Phase 6 Outcome

Phase 6 is complete only when all of the following are true:

- tenant users can review posted GL lines safely
- trial balance is derived from posted journal lines only
- profit and loss is derived from posted journal lines only
- balance sheet is derived from posted journal lines only
- AR aging is derived from finance-controlled invoice/payment effects and restricted to successfully posted ERP-Lite invoices
- report queries remain tenant-scoped
- report routes are gated by ERP-Lite feature flags and permissions
- report UI is bilingual in EN/AR

## 4. Runtime Checklist

- [x] add reporting service for GL inquiry
- [x] add reporting service for trial balance
- [x] add reporting service for profit and loss
- [x] add reporting service for balance sheet
- [x] add reporting service for AR aging
- [x] update `/dashboard/erp-lite/gl`
- [x] update `/dashboard/erp-lite/reports`
- [x] update `/dashboard/erp-lite/ar`
- [x] add EN/AR report copy
- [x] validate report queries against posted-journal truth

## 5. Final Readiness Gate

Phase 6 can start safely only when:

- Phase 5 is complete
- posted journals exist as source-of-truth runtime data
- no report depends on unpublished governance assumptions
