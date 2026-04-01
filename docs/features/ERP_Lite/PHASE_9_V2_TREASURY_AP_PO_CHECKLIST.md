---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_9_V2_CHECKLIST_2026_04_01
status: In Progress
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite Phase 9 V2 Treasury, Suppliers, AP, PO Checklist

## 1. Purpose

This document defines the exact checklist for `Phase 9: V2 Treasury + Suppliers + AP/PO`.

Phase 9 is limited to:
- treasury runtime foundations in `cleanmatex`
- supplier and procurement runtime foundations in `cleanmatex`
- required governance extensions in `cleanmatexsaas`
- bank reconciliation, supplier master, purchase orders, AP invoices, AP payments, and AP aging

Phase 9 must not:
- redefine v1 accounting truth
- bypass governed posting packages or tenant usage mappings
- introduce profitability or costing logic from v3

## 2. Canonical Dependencies

- [V2_V3_READINESS_ASSESSMENT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V2_V3_READINESS_ASSESSMENT.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)
- [PHASE_2B_HQ_GOVERNANCE_APP_EXECUTION_PACKAGE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/PHASE_2B_HQ_GOVERNANCE_APP_EXECUTION_PACKAGE.md)
- [PHASE_8_V1_PILOT_AND_HARDENING_EXECUTION_PACKAGE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/PHASE_8_V1_PILOT_AND_HARDENING_EXECUTION_PACKAGE.md)

## 3. Phase 9 Outcome

Phase 9 is complete only when all of the following are true:

- tenant bank-account and statement-import foundations exist
- supplier master exists with payable-ready controls
- PO runtime exists with controlled lifecycle
- AP invoice and AP payment runtime exists
- AP aging exists and reconciles to payable control behavior
- bank matching and reconciliation runtime exists with auditability
- required governance event and usage-code extensions are defined and published

## 4. Cross-Project Ownership

### 4.1 cleanmatexsaas

- extend governed event families for AP, PO, and bank flows
- extend governed usage codes for supplier, payable, and bank dimensions
- extend HQ authoring for Phase 9 posting packages and auto-post policies

### 4.2 cleanmatex

- own all tenant runtime schema and RLS for v2 finance tables
- implement supplier, PO, AP, bank statement, matching, and reconciliation runtime
- keep all runtime reads/writes tenant-scoped

## 5. Schema Checklist

- [x] create bank-account and bank-statement schema package
- [x] create supplier master schema package
- [x] create PO and AP document schema package
- [x] create AP payment and bank-reconciliation schema package
- [x] add RLS to all new `org_*` tables
- [x] preserve audit and traceability fields in all new runtime tables

## 6. Governance Checklist

- [ ] define Phase 9 event-family extension plan
- [ ] define supplier/AP/bank usage-code extension plan
- [ ] define Phase 9 posting package set
- [ ] define Phase 9 auto-post policy boundaries

## 7. Runtime Checklist

- [x] implement supplier master write/read services
- [x] implement PO write/read services
- [x] implement AP invoice write/read services
- [x] implement AP payment write/read services
- [x] implement bank import and line-matching services
- [x] implement AP aging and bank-reconciliation inquiry views
- [x] implement bulk statement-line import, reversible matching, and reconciliation lock flow

## 8. Final Readiness Gate

Phase 9 can continue safely because:

- [x] Phase 8 is complete
- [x] the Phase 9 execution package is accepted
- [x] Phase 9 migrations are reviewed and applied
- [x] tenant-side Phase 9 runtime validation passes through ERP-Lite regression tests and `web-admin` production build
