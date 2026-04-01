---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_9_V2_EXEC_PKG_2026_04_01
status: In Progress
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite Phase 9 V2 Treasury, Suppliers, AP, PO Execution Package

## 1. Purpose

This document defines the implementation-ready package for `Phase 9: V2 Treasury + Suppliers + AP/PO`.

## 2. Scope

Phase 9 includes:
- bank account master
- bank statement import header/detail
- bank matching and reconciliation foundations
- supplier master
- purchase order header/detail
- AP invoice header/detail
- AP payment header/allocation
- AP aging inquiry

Phase 9 does not include:
- advanced bank feeds beyond the agreed import model
- profitability or costing logic
- v3 approval workflow depth

## 3. Immediate Schema Package

The first Phase 9 schema package in `cleanmatex` is split into four migrations:

1. `0189_erp_lite_phase9_bank_core.sql`
2. `0190_erp_lite_phase9_supplier_master.sql`
3. `0191_erp_lite_phase9_po_ap_docs.sql`
4. `0192_erp_lite_phase9_ap_pmt_bank_recon.sql`

These migrations are now applied in `cleanmatex` as the tenant-runtime Phase 9 schema baseline.

## 4. Runtime Design Rules

- all AP and bank runtime tables must use `tenant_org_id`
- all runtime FKs must preserve tenant isolation through composite keys where applicable
- supplier/AP/bank accounts must resolve through governed account types and tenant account mappings
- statement imports must preserve raw reference traceability
- AP aging must reconcile to payable control-account behavior
- bank matching must be reversible and auditable

## 5. Governance Extension Rules

Phase 9 runtime depends on new HQ governance work in `cleanmatexsaas` for:
- AP invoice event family
- AP payment event family
- PO event family where posting is governed
- bank reconciliation and bank-fee event family where approved
- supplier/AP/bank usage codes

## 6. Next Runtime Slices After Schema

After the Phase 9 schema baseline:

1. supplier master services and screen
2. PO services and screen
3. AP invoice services and screen
4. AP payment services and screen
5. bank statement import and matching services
6. AP aging and bank reconciliation inquiry

## 7. Validation Targets

Phase 9 must validate:
- tenant isolation on all new tables
- AP open-balance math
- AP payment allocation integrity
- statement-line deduplication and import traceability
- bank matching reversibility
- AP aging correctness

## 8. Current Runtime Status

Implemented now in `cleanmatex`:
- supplier master create/list foundation
- PO create/list foundation
- AP invoice create/list foundation
- AP payment create/list foundation with open-balance reduction
- bank account create/list foundation
- bank statement header create/list foundation
- bank reconciliation header create/list foundation
- tenant-scoped Phase 9 numbering and targeted service tests

Still pending before Phase 9 can close:
- AP aging inquiry
- bank statement line import
- bank matching and confirmation/reversal flows
- reconciliation close/lock flows
- related Phase 9 governance publication extension in `cleanmatexsaas`
