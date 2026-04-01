---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_V2_SCOPE_AND_DECISION_PACK_2026_04_01
status: Draft
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite V2 Scope and Decision Pack

## 1. Purpose

This document freezes the business and implementation boundaries for `v2`.

## 2. v2 Scope

Included:
- bank accounts
- bank statement import
- bank matching and reconciliation
- supplier master
- purchase orders
- AP invoices
- AP payments
- AP aging

Excluded:
- advanced bank feeds beyond approved import model
- advanced supplier portal
- profitability and costing

## 3. Core Decisions

- bank reconciliation is `import-first` with manual correction support
- AP is `invoice-first` while still preserving optional PO linkage
- PO is lightweight in v2 and does not require a deep approval engine
- AP and bank posting must remain governed by HQ event and usage-code catalogs

## 4. Required ADR Set

- [ADR_005_SUPPLIER_AP_GOVERNANCE_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_005_SUPPLIER_AP_GOVERNANCE_MODEL.md)
- [ADR_006_BANK_RECONCILIATION_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_006_BANK_RECONCILIATION_MODEL.md)
- [ADR_007_PO_TO_AP_POSTING_BOUNDARIES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_007_PO_TO_AP_POSTING_BOUNDARIES.md)

## 5. Start Gate

v2 runtime coding must not proceed past schema-first until:
- Phase 9 migrations are reviewed and applied
- HQ governance extensions are approved
- the three v2 ADRs are approved

